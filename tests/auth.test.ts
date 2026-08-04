import { describe, expect, it } from "vitest";

import {
  CHECK_INBOX_MESSAGE,
  CREDENTIALS_MESSAGE,
  GENERIC_MESSAGE,
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  loginErrorMessage,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth";

describe("email", () => {
  it("normalises case and surrounding space", () => {
    const parsed = signInSchema.parse({
      email: "  Host@Example.COM ",
      password: "whatever",
    });
    expect(parsed.email).toBe("host@example.com");
  });

  it("rejects a string that is not an address", () => {
    const result = signInSchema.safeParse({
      email: "not-an-address",
      password: "whatever",
    });
    expect(result.success).toBe(false);
  });
});

describe("password", () => {
  it("requires the minimum only when creating an account", () => {
    // An account made before this rule existed may have a six-character
    // password. Signing in must not lock those people out.
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "abc123" }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "abc123" }).success,
    ).toBe(false);
  });

  it("accepts a password at the minimum length", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(signUpSchema.safeParse({ email: "a@b.com", password }).success).toBe(
      true,
    );
  });

  it("rejects a password past the bcrypt truncation point", () => {
    // Supabase hashes with bcrypt, which ignores everything past 72 bytes.
    // Accepting a longer one would silently make the tail meaningless.
    const password = "a".repeat(73);
    expect(signUpSchema.safeParse({ email: "a@b.com", password }).success).toBe(
      false,
    );
  });

  it("requires a non-empty password to sign in", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("sign-up name", () => {
  it("is optional", () => {
    const result = signUpSchema.safeParse({
      email: "a@b.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.full_name).toBeUndefined();
  });

  it("trims, and treats blank as absent", () => {
    const result = signUpSchema.parse({
      email: "a@b.com",
      password: "12345678",
      full_name: "  Ana Marić  ",
    });
    expect(result.full_name).toBe("Ana Marić");

    const blank = signUpSchema.parse({
      email: "a@b.com",
      password: "12345678",
      full_name: "   ",
    });
    expect(blank.full_name).toBeUndefined();
  });

  it("rejects a name longer than the profiles column expects", () => {
    const result = signUpSchema.safeParse({
      email: "a@b.com",
      password: "12345678",
      full_name: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });
});

describe("update password", () => {
  it("requires both entries to match", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "12345678",
        confirm: "12345678",
      }).success,
    ).toBe(true);
    expect(
      updatePasswordSchema.safeParse({
        password: "12345678",
        confirm: "87654321",
      }).success,
    ).toBe(false);
  });
});

describe("reset request", () => {
  it("only needs an address", () => {
    expect(resetRequestSchema.safeParse({ email: "a@b.com" }).success).toBe(
      true,
    );
  });
});

describe("authErrorMessage", () => {
  it("gives one sentence for a wrong password and for an unknown address", () => {
    // Two different failures, one message. Anything else lets a stranger test
    // whether an address has an account here.
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe(
      CREDENTIALS_MESSAGE,
    );
  });

  it("treats an existing address at sign-up as an ordinary inbox check", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toBe(
      CHECK_INBOX_MESSAGE,
    );
  });

  it("never leaks an unrecognised provider error", () => {
    expect(authErrorMessage({ code: "some_new_supabase_code" })).toBe(
      GENERIC_MESSAGE,
    );
    expect(authErrorMessage(null)).toBe(GENERIC_MESSAGE);
  });
});

describe("loginErrorMessage", () => {
  it("turns a link failure into a sentence", () => {
    expect(loginErrorMessage("expired_link")).toMatch(/expired/i);
  });

  it("passes through what the OAuth callback already puts in the query", () => {
    // auth/callback puts a provider message in ?error=. Keep showing it.
    expect(loginErrorMessage("Google said no")).toBe("Google said no");
  });

  it("returns undefined when there is no error", () => {
    expect(loginErrorMessage(undefined)).toBeUndefined();
  });
});
