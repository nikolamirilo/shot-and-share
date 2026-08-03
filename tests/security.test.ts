import { beforeEach, describe, expect, it } from "vitest";

import { decryptToken, encryptToken, resetKeyCache } from "@/lib/crypto";
import { parseWebhook, verifySignature } from "@/lib/payments/lemonsqueezy";
import { generateToken, hashToken, looksLikeToken, shareUrl } from "@/lib/tokens";

describe("share tokens", () => {
  it("issues high-entropy tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(looksLikeToken(token)).toBe(true);
    }
  });

  it("hashes deterministically, so lookup works without storing the secret", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it("rejects anything that is not the shape we issue", () => {
    // Tokens arrive in a URL path, so the filter runs before any query.
    expect(looksLikeToken("short")).toBe(false);
    expect(looksLikeToken("../../etc/passwd")).toBe(false);
    expect(looksLikeToken("' or 1=1 --")).toBe(false);
    expect(looksLikeToken("a".repeat(200))).toBe(false);
  });

  it("builds a share URL without doubling the slash", () => {
    expect(shareUrl("https://saycheese.app/", "abc")).toBe(
      "https://saycheese.app/e/abc",
    );
    expect(shareUrl("https://saycheese.app", "abc")).toBe(
      "https://saycheese.app/e/abc",
    );
  });
});

describe("token encryption at rest", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    resetKeyCache();
  });

  it("round-trips", () => {
    const token = generateToken();
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("produces a different ciphertext every time", () => {
    const token = generateToken();
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  it("refuses a tampered ciphertext rather than returning garbage", () => {
    const payload = encryptToken("hello");
    const [iv, data, tag] = payload.split(".");
    const flipped = `${iv}.${data.slice(0, -2)}AA.${tag}`;
    expect(decryptToken(flipped)).toBeNull();
  });

  it("returns null on nonsense instead of throwing", () => {
    expect(decryptToken("not-a-payload")).toBeNull();
    expect(decryptToken("")).toBeNull();
  });

  it("rejects a key that is the wrong length", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    resetKeyCache();
    expect(() => encryptToken("x")).toThrow(/32 bytes/);
  });
});

describe("payment webhooks", () => {
  const secret = "whsec_test";

  beforeEach(() => {
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = secret;
  });

  function sign(body: string) {
    // Matches the provider: HMAC-SHA256 of the raw body, hex encoded.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHmac } = require("node:crypto");
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("rejects a body that was modified after signing", () => {
    const body = JSON.stringify({ total: 100 });
    const signature = sign(body);
    const tampered = JSON.stringify({ total: 999999 });
    expect(verifySignature(tampered, signature)).toBe(false);
  });

  it("rejects an empty or wrong-length signature without throwing", () => {
    expect(verifySignature("{}", "")).toBe(false);
    expect(verifySignature("{}", "abc")).toBe(false);
  });

  it("pulls the event and product out of custom data", () => {
    const parsed = parseWebhook({
      meta: {
        event_name: "order_created",
        custom_data: { event_id: "evt-1", product: "wedding" },
      },
      data: {
        id: "12345",
        attributes: { total: 3900, currency: "EUR", status: "paid" },
      },
    });

    expect(parsed).toMatchObject({
      eventName: "order_created",
      txnId: "12345",
      eventId: "evt-1",
      product: "wedding",
      amountCents: 3900,
      currency: "EUR",
    });
  });

  it("returns null when there is no transaction id to be idempotent on", () => {
    expect(parseWebhook({ meta: { event_name: "order_created" } })).toBeNull();
    expect(parseWebhook({})).toBeNull();
  });
});
