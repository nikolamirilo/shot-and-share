import { describe, expect, it } from "vitest";

import {
  CHECK_INBOX_MESSAGE,
  GENERIC_MESSAGE,
  authErrorMessage,
  loginErrorMessage,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth";

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

  it("rejects a password past the bcrypt truncation point", () => {
    // Supabase hashes with bcrypt, which ignores everything past 72 bytes.
    // Accepting a longer one would silently make the tail meaningless.
    const password = "a".repeat(73);
    expect(signUpSchema.safeParse({ email: "a@b.com", password }).success).toBe(
      false,
    );
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

describe("authErrorMessage", () => {
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
  it("passes through what the OAuth callback already puts in the query", () => {
    // auth/callback puts a provider message in ?error=. Keep showing it.
    expect(loginErrorMessage("Google said no")).toBe("Google said no");
  });
});
