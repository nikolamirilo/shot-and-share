/**
 * A Supabase client small enough to reason about.
 *
 * The upload handshake is the one place where getting the *order* of database
 * calls wrong is invisible until a host's quota is quietly wrong: reserve, then
 * write, then sign, and undo the first two if the third throws. Asserting on
 * that needs a store that actually holds rows between calls rather than a
 * `vi.fn()` per method, because the interesting bugs are the ones where a row
 * is left behind.
 *
 * It implements exactly the surface the routes use and nothing else. A missing
 * method here should be added when a route starts calling it, not in advance.
 */

export interface StoredError {
  message: string;
  code?: string;
}

type Row = Record<string, unknown>;
type Mode = "select" | "delete" | "update";

class Query {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private ordering?: { column: string; ascending: boolean };
  private ceiling?: number;

  constructor(
    private readonly rows: Row[],
    private readonly mode: Mode,
    private readonly patch?: Row,
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  lt(column: string, value: string) {
    this.filters.push((row) => String(row[column]) < value);
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push((row) => String(row[column]) <= value);
    return this;
  }

  /** Only the `not(column, "is", null)` form the retention job uses. */
  not(column: string, _operator: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.ordering = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count?: number) {
    this.ceiling = count;
    return this;
  }

  private run(): { data: Row[]; error: null } {
    let matched = this.rows.filter((row) =>
      this.filters.every((test) => test(row)),
    );

    /*
     * Ordering and the row limit are applied to reads only. A delete or an
     * update matches whatever the filters matched - which is what Postgres
     * does, and what stops a `.limit()` left on a builder from silently
     * sparing rows the caller meant to remove.
     */
    if (this.mode === "select") {
      if (this.ordering) {
        const { column, ascending } = this.ordering;
        matched = [...matched].sort((a, b) => {
          const left = String(a[column]);
          const right = String(b[column]);
          if (left === right) return 0;
          return (left < right ? -1 : 1) * (ascending ? 1 : -1);
        });
      }
      if (this.ceiling !== undefined) matched = matched.slice(0, this.ceiling);
    }

    if (this.mode === "delete") {
      for (const row of matched) {
        const at = this.rows.indexOf(row);
        if (at >= 0) this.rows.splice(at, 1);
      }
    }
    if (this.mode === "update" && this.patch) {
      for (const row of matched) Object.assign(row, this.patch);
    }

    return { data: matched, error: null };
  }

  async maybeSingle() {
    const { data, error } = this.run();
    return { data: data[0] ?? null, error };
  }

  // Thenable, so `await client.from(...).delete().eq(...)` resolves the way the
  // real builder does.
  then<T>(resolve: (value: { data: Row[]; error: null }) => T) {
    return Promise.resolve(this.run()).then(resolve);
  }
}

export function createStore() {
  const tables: Record<string, Row[]> = {};
  const insertFailures: Record<string, StoredError | undefined> = {};
  const calls: Array<{ fn: string; args: Row }> = [];
  let reserveSucceeds = true;

  const table = (name: string) => (tables[name] ??= []);

  const client = {
    rpc: async (fn: string, args: Row) => {
      calls.push({ fn, args });
      if (fn === "reserve_storage") {
        return { data: reserveSucceeds, error: null };
      }
      return { data: null, error: null };
    },
    from: (name: string) => ({
      select: () => new Query(table(name), "select"),
      insert: async (values: Row | Row[]) => {
        const failure = insertFailures[name];
        if (failure) return { error: failure };
        table(name).push(...(Array.isArray(values) ? values : [values]));
        return { error: null };
      },
      delete: () => new Query(table(name), "delete"),
      update: (patch: Row) => new Query(table(name), "update", patch),
    }),
  };

  return {
    /** Passed wherever the code under test expects `createAdminClient()`. */
    client,
    rows: (name: string) => table(name),
    /** Every rpc the route made, in order. */
    calls,
    released() {
      return calls
        .filter((c) => c.fn === "release_storage")
        .reduce((sum, c) => sum + Number(c.args.p_bytes), 0);
    },
    reserved() {
      return calls
        .filter((c) => c.fn === "reserve_storage")
        .reduce((sum, c) => sum + Number(c.args.p_bytes), 0);
    },
    failInsert(name: string, error: StoredError | undefined) {
      insertFailures[name] = error;
    },
    setReserveSucceeds(value: boolean) {
      reserveSucceeds = value;
    },
    reset() {
      for (const name of Object.keys(tables)) delete tables[name];
      for (const name of Object.keys(insertFailures)) {
        delete insertFailures[name];
      }
      calls.length = 0;
      reserveSucceeds = true;
    },
  };
}

export type Store = ReturnType<typeof createStore>;
