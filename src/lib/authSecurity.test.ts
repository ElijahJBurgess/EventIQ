import { describe, expect, it } from "vitest";
import {
  meetsPasswordMinimum,
  PASSWORD_REQUIREMENT_MESSAGE,
  safePasswordUpdateError,
  safeSignInError,
  safeSignUpError,
} from "./authSecurity";

describe("V1 authentication messages", () => {
  it("uses a consistent eight-character password minimum", () => {
    expect(meetsPasswordMinimum("1234567")).toBe(false);
    expect(meetsPasswordMinimum("12345678")).toBe(true);
    expect(PASSWORD_REQUIREMENT_MESSAGE).toContain("8 characters");
  });

  it("does not expose raw signup or update errors", () => {
    expect(safeSignUpError("database connection failed")).toBe("Unable to create your account. Please try again.");
    expect(safePasswordUpdateError("token internals leaked")).toBe(
      "Unable to update your password. Request a new reset link and try again.",
    );
  });

  it("keeps sign-in failures generic while explaining verified-email requirements", () => {
    const genericMessage = "Email or password is incorrect, or the email has not been verified.";
    expect(safeSignInError("Invalid login credentials")).toBe(genericMessage);
    expect(safeSignInError("Email not confirmed")).toBe(genericMessage);
  });
});
