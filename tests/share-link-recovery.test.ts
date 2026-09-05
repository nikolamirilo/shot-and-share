import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";

/**
 * What happens to a share link when the encryption key changes underneath it.
 *
 * The link itself survives - guests are matched on a hash, which has no key in
 * it - but the copy the dashboard reads back does not. Getting this wrong is
 * expensive in a way tests are cheap: the host is shown "no active link", takes
 * the one button on offer, and every printed card on every table stops working
 * to fix what was only a display problem.
 */

const store = createStore();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));
vi.mock("@/lib/actions/guards", () => ({
  requireOwnedEvent: vi.fn(async () => ({})),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { encryptToken, decryptToken, readToken, resetKeyCache } = await import(
  "@/lib/crypto"
);
const { getShareLinkState } = await import("@/lib/events");
const { restoreShareLink } = await import("@/lib/actions/share-links");
const { generateToken, hashToken } = await import("@/lib/tokens");

const OLD_KEY = Buffer.alloc(32, 1).toString("base64");
const NEW_KEY = Buffer.alloc(32, 2).toString("base64");
const EVENT = "11111111-2222-3333-4444-555555555555";

/** Both keys are per-process caches, so every change goes through here. */
function useKeys(current: string, previous?: string) {
  process.env.TOKEN_ENCRYPTION_KEY = current;
  if (previous) {
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = previous;
  } else {
    delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  }
  resetKeyCache();
}

function seed(row: Record<string, unknown>) {
  store.rows("event_tokens").push({
    id: "token-1",
    event_id: EVENT,
    label: "Primary link",
    revoked: false,
    created_at: "2026-08-21T08:35:37.789Z",
    ...row,
  });
}

beforeEach(() => {
  store.reset();
  useKeys(NEW_KEY);
});

describe("reading a token written under an older key", () => {
  it("finds it, and says it was found the slow way", () => {
    useKeys(OLD_KEY);
    const token = generateToken();
    const cipher = encryptToken(token);

    useKeys(NEW_KEY, OLD_KEY);
    expect(readToken(cipher)).toEqual({ token, stale: true });
  });

  it("gives up rather than guessing when no key fits", () => {
    useKeys(OLD_KEY);
    const cipher = encryptToken(generateToken());

    useKeys(NEW_KEY);
    expect(decryptToken(cipher)).toBeNull();
  });
});

describe("the state of an event's link", () => {
  it("stores the token again under the current key once it has read it", async () => {
    useKeys(OLD_KEY);
    const token = generateToken();
    seed({ token_hash: hashToken(token), token_cipher: encryptToken(token) });

    useKeys(NEW_KEY, OLD_KEY);
    expect(await getShareLinkState(EVENT)).toMatchObject({
      state: "active",
      token,
    });

    // The old key can now be dropped: what is stored opens with the new one.
    useKeys(NEW_KEY);
    const stored = store.rows("event_tokens")[0].token_cipher as string;
    expect(decryptToken(stored)).toBe(token);
  });

  it("says unreadable, not revoked, when the key is gone", async () => {
    useKeys(OLD_KEY);
    const token = generateToken();
    seed({ token_hash: hashToken(token), token_cipher: encryptToken(token) });

    useKeys(NEW_KEY);
    expect(await getShareLinkState(EVENT)).toEqual({
      state: "unreadable",
      tokenId: "token-1",
    });
  });

  it("says none when the host has actually turned the link off", async () => {
    const token = generateToken();
    seed({
      token_hash: hashToken(token),
      token_cipher: encryptToken(token),
      revoked: true,
    });

    expect(await getShareLinkState(EVENT)).toEqual({ state: "none" });
  });
});

describe("restoring a link the host still has", () => {
  it("takes the pasted link and makes the panel work again", async () => {
    useKeys(OLD_KEY);
    const token = generateToken();
    seed({
      token_hash: hashToken(token),
      token_cipher: encryptToken(token),
      revoked: true,
    });

    useKeys(NEW_KEY);
    const result = await restoreShareLink(
      EVENT,
      `https://www.shotandshare.com/e/${token}`,
    );

    expect(result).toEqual({ ok: true });
    expect(await getShareLinkState(EVENT)).toMatchObject({
      state: "active",
      token,
    });
    // A link in the host's hand is a link they expect to work.
    expect(store.rows("event_tokens")[0].revoked).toBe(false);
  });

  it("refuses a link that was never issued for this event", async () => {
    const token = generateToken();
    seed({ token_hash: hashToken(token), token_cipher: encryptToken(token) });

    const result = await restoreShareLink(
      EVENT,
      `https://www.shotandshare.com/e/${generateToken()}`,
    );

    expect(result.ok).toBeUndefined();
    expect(result.error).toMatch(/not issued for this event/);
  });

  it("refuses something that is not a link at all", async () => {
    const result = await restoreShareLink(EVENT, "no idea, sorry");
    expect(result.error).toMatch(/does not look like/);
  });
});
