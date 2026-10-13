import { beforeEach, describe, expect, it, vi } from "vitest";

import { FREE_LIMIT_NOTICE, MAX_FREE_EVENTS, TIERS } from "@/lib/tiers";

type Row = Record<string, unknown>;

const OWNER = "00000000-1111-2222-3333-444444444444";

let rows: Row[] = [];
/** What the insert returns, so the trigger's error can be played back. */
let insertError: { message: string } | null = null;
let user = { id: OWNER };

/**
 * Narrower than tests/stubs/supabase: this action needs the exact-count head
 * query and the insert().select().single() chain, which that store has not met.
 */
const supabase = {
  from: () => ({
    select: (_columns: string, options?: { count?: string; head?: boolean }) => {
      const filters: Row = {};
      const query = {
        eq(column: string, value: unknown) {
          filters[column] = value;
          return query;
        },
        then<T>(resolve: (value: { count: number; error: null }) => T) {
          const matched = rows.filter((row) =>
            Object.entries(filters).every(([key, value]) => row[key] === value),
          );
          expect(options?.count).toBe("exact");
          return Promise.resolve(resolve({ count: matched.length, error: null }));
        },
      };
      return query;
    },
    insert: (values: Row) => ({
      select: () => ({
        single: async () => {
          if (insertError) return { data: null, error: insertError };
          rows.push(values);
          return { data: { id: "created" }, error: null };
        },
      }),
    }),
  }),
};

vi.mock("@/lib/guards/host-action", () => ({
  requireUser: async () => ({ supabase, user }),
}));

vi.mock("@/lib/share-tokens", () => ({
  issueTokenFor: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

const { createEvent } = await import("@/lib/actions/events");

function freeEvent(index: number): Row {
  return { id: `free-${index}`, owner_id: OWNER, tier: TIERS.free.id };
}

async function create(name = "Romeo and Juliet") {
  const form = new FormData();
  form.set("name", name);
  try {
    return await createEvent({}, form);
  } catch (error) {
    // A successful create ends in redirect(), which throws.
    const message = String((error as Error).message);
    if (message.startsWith("REDIRECT:")) return { ok: true as const };
    throw error;
  }
}

describe("free event limit", () => {
  let owners = 0;

  beforeEach(() => {
    rows = [];
    insertError = null;
    // A fresh id per test: the create limiter counts per user.
    owners += 1;
    user = { id: `${OWNER.slice(0, -2)}${String(owners).padStart(2, "0")}` };
  });

  it("holds one free event, which the migration and the copy assume", () => {
    expect(MAX_FREE_EVENTS).toBe(1);
  });

  it("creates while under the cap", async () => {
    for (let i = 0; i < MAX_FREE_EVENTS - 1; i += 1) {
      rows.push({ ...freeEvent(i), owner_id: user.id });
    }

    await expect(create()).resolves.toEqual({ ok: true });
    expect(rows).toHaveLength(MAX_FREE_EVENTS);
  });

  it("refuses the one past the cap", async () => {
    for (let i = 0; i < MAX_FREE_EVENTS; i += 1) {
      rows.push({ ...freeEvent(i), owner_id: user.id });
    }

    await expect(create()).resolves.toEqual({ error: FREE_LIMIT_NOTICE });
    expect(rows).toHaveLength(MAX_FREE_EVENTS);
  });

  it("counts only this owner's free events", async () => {
    for (let i = 0; i < MAX_FREE_EVENTS; i += 1) {
      rows.push({ ...freeEvent(i), owner_id: "somebody-else" });
    }

    await expect(create()).resolves.toEqual({ ok: true });
  });

  it("does not count events on a paid plan", async () => {
    for (let i = 0; i < MAX_FREE_EVENTS; i += 1) {
      rows.push({ ...freeEvent(i), owner_id: user.id, tier: TIERS.plus.id });
    }

    await expect(create()).resolves.toEqual({ ok: true });
  });

  it("turns the trigger's error into the same notice", async () => {
    insertError = {
      message: 'new row violates check: "free_event_limit_reached"',
    };

    await expect(create()).resolves.toEqual({ error: FREE_LIMIT_NOTICE });
  });
});
