export type ActionState = { ok?: boolean; error?: string };
type W = typeof window & { CALLS: Array<Record<string, string>>; FAIL?: boolean };
export async function updateAppearance(
  _id: string,
  _prev: ActionState,
  body: FormData,
): Promise<ActionState> {
  const w = window as W;
  w.CALLS = w.CALLS ?? [];
  w.CALLS.push(Object.fromEntries(body.entries()) as Record<string, string>);
  await new Promise((r) => setTimeout(r, 50));
  return (window as W).FAIL ? { error: "nope" } : { ok: true };
}
