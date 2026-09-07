import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/password.js";
import {
  generateSessionToken,
  hashToken,
  tokenHashesEqual,
} from "../src/session.js";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toContain("correct-horse-battery");
    expect(await verifyPassword(hash, "correct-horse-battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("rejects short passwords", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("verifyPassword is false for a null hash", async () => {
    expect(await verifyPassword(null, "anything-goes-here")).toBe(false);
  });
});

describe("session tokens", () => {
  it("generates distinct tokens and stable hashes", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toEqual(b);
    expect(hashToken(a)).toEqual(hashToken(a));
    expect(hashToken(a)).not.toEqual(hashToken(b));
  });

  it("compares hashes in constant time", () => {
    const t = generateSessionToken();
    expect(tokenHashesEqual(hashToken(t), hashToken(t))).toBe(true);
    expect(tokenHashesEqual(hashToken(t), hashToken("other"))).toBe(false);
  });
});
