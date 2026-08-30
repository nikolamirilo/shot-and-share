import { beforeEach, describe, expect, it } from "vitest";

import { decryptToken, encryptToken, resetKeyCache } from "@/lib/crypto";
import { parseWebhook, verifySignature } from "@/lib/payments/creem";
import { TIERS } from "@/lib/tiers";
import { generateToken, looksLikeToken, shareUrl } from "@/lib/tokens";

describe("share tokens", () => {
  it("issues high-entropy tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(looksLikeToken(token)).toBe(true);
    }
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
});

describe("payment webhooks", () => {
  const secret = "whsec_test";

  beforeEach(() => {
    process.env.CREEM_WEBHOOK_SECRET = secret;
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require("node:crypto");

  /** The documented scheme: hex HMAC-SHA256 of the raw body. */
  function legacy(body: string, key = secret) {
    return new Headers({
      "creem-signature": createHmac("sha256", key).update(body).digest("hex"),
    });
  }

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifySignature(body, legacy(body))).toBe(true);
  });

  it("rejects a body that was modified after signing", () => {
    const body = JSON.stringify({ total: 100 });
    const headers = legacy(body);
    const tampered = JSON.stringify({ total: 999999 });
    expect(verifySignature(tampered, headers)).toBe(false);
  });

  it("rejects an empty, missing or wrong-length signature without throwing", () => {
    expect(verifySignature("{}", new Headers())).toBe(false);
    expect(verifySignature("{}", new Headers({ "creem-signature": "" }))).toBe(
      false,
    );
    expect(verifySignature("{}", new Headers({ "creem-signature": "abc" }))).toBe(
      false,
    );
  });

  /*
   * Creem's SDK accepts a `sha256=` prefix and an `x-creem-signature` spelling
   * that the documentation never mentions. Both are cheap to accept and the
   * cost of not accepting one is every delivery rejected.
   */
  it("accepts the header spellings the provider's own SDK accepts", () => {
    const body = JSON.stringify({ hello: "world" });
    const digest = createHmac("sha256", secret).update(body).digest("hex");

    expect(
      verifySignature(body, new Headers({ "creem-signature": `sha256=${digest}` })),
    ).toBe(true);
    expect(
      verifySignature(body, new Headers({ "x-creem-signature": digest })),
    ).toBe(true);
    expect(
      verifySignature(
        body,
        new Headers({ "creem-signature": digest.toUpperCase() }),
      ),
    ).toBe(true);
  });

  /*
   * The scheme the documentation does not describe and the SDK checks first.
   * An account on this one sends every delivery with these three headers, and
   * an integration that only implements the documented scheme rejects all of
   * them - which looks exactly like paying customers whose plan never changed.
   */
  describe("the Standard Webhooks scheme", () => {
    const standardSecret = "whsec_" + Buffer.from("a-real-key").toString("base64");

    function standard(
      body: string,
      over: { id?: string; timestamp?: number; secret?: string } = {},
    ) {
      const id = over.id ?? "evt_1";
      const timestamp = over.timestamp ?? Math.floor(Date.now() / 1000);
      const key = Buffer.from(
        (over.secret ?? standardSecret).replace(/^whsec_/, ""),
        "base64",
      );
      const digest = createHmac("sha256", key)
        .update(`${id}.${timestamp}.${body}`)
        .digest("base64");
      return new Headers({
        "webhook-id": id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": `v1,${digest}`,
      });
    }

    beforeEach(() => {
      process.env.CREEM_WEBHOOK_SECRET = standardSecret;
    });

    it("accepts a correctly signed body", () => {
      const body = JSON.stringify({ hello: "world" });
      expect(verifySignature(body, standard(body))).toBe(true);
    });

    it("signs over the id and timestamp too, not the body alone", () => {
      const body = JSON.stringify({ hello: "world" });
      const headers = standard(body, { id: "evt_1" });
      headers.set("webhook-id", "evt_2");
      expect(verifySignature(body, headers)).toBe(false);
    });

    it("refuses a delivery signed too long ago to be live", () => {
      const body = JSON.stringify({ hello: "world" });
      const old = Math.floor(Date.now() / 1000) - 60 * 60;
      expect(verifySignature(body, standard(body, { timestamp: old }))).toBe(
        false,
      );
    });

    it("refuses a timestamp from the future", () => {
      const body = JSON.stringify({ hello: "world" });
      const ahead = Math.floor(Date.now() / 1000) + 60 * 60;
      expect(verifySignature(body, standard(body, { timestamp: ahead }))).toBe(
        false,
      );
    });

    /* A secret rotation sends both signatures for a while. Either may match. */
    it("takes any one of the versioned signatures offered", () => {
      const body = JSON.stringify({ hello: "world" });
      const headers = standard(body);
      const good = headers.get("webhook-signature")!;
      headers.set("webhook-signature", `v1,not-the-signature ${good}`);
      expect(verifySignature(body, headers)).toBe(true);
    });
  });

  it("pulls the event and product out of checkout metadata", () => {
    const parsed = parseWebhook({
      id: "evt_1",
      eventType: "checkout.completed",
      object: {
        id: "ch_1",
        object: "checkout",
        status: "completed",
        order: {
          id: "ord_1",
          product: TIERS.pro.id,
          amount: 3900,
          currency: "EUR",
          status: "paid",
        },
        metadata: { event_id: "evt-1", owner_id: "own-1", product: "pro" },
      },
    });

    expect(parsed).toMatchObject({
      eventName: "checkout.completed",
      eventId: "evt-1",
      ownerId: "own-1",
      product: "pro",
      orderId: "ord_1",
      amountCents: 3900,
      currency: "EUR",
    });
  });
});
