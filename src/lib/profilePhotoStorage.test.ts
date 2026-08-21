import { describe, expect, it, vi } from "vitest";
import {
  createProfilePhotoPath,
  getOwnedProfilePhotoPath,
  isAllowedProfilePhotoType,
  MAX_PROFILE_PHOTO_BYTES,
} from "./profilePhotoStorage";

const USER_ID = "8b392776-ee69-4337-92ce-f2fe8d59e5e6";

describe("profile photo storage", () => {
  it("accepts only the bucket-supported image MIME types", () => {
    expect(isAllowedProfilePhotoType("image/jpeg")).toBe(true);
    expect(isAllowedProfilePhotoType("image/png")).toBe(true);
    expect(isAllowedProfilePhotoType("image/webp")).toBe(true);
    expect(isAllowedProfilePhotoType("image/gif")).toBe(false);
    expect(isAllowedProfilePhotoType("text/plain")).toBe(false);
    expect(MAX_PROFILE_PHOTO_BYTES).toBe(5 * 1024 * 1024);
  });

  it("generates an authenticated user-scoped path from the MIME type", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("12345678-1234-4234-8234-123456789abc");
    expect(createProfilePhotoPath(USER_ID, "image/jpeg")).toBe(
      `${USER_ID}/12345678-1234-4234-8234-123456789abc.jpg`,
    );
    vi.restoreAllMocks();
  });

  it("returns cleanup paths only for the expected user's generated objects", () => {
    const ownUrl = `https://project.supabase.co/storage/v1/object/public/profile-photos/${USER_ID}/photo.webp`;
    expect(getOwnedProfilePhotoPath(ownUrl, USER_ID)).toBe(`${USER_ID}/photo.webp`);
    expect(getOwnedProfilePhotoPath(ownUrl, "c67efae2-3cb9-4c75-a3f2-5e30e1d65822")).toBeNull();
    expect(getOwnedProfilePhotoPath("https://project.supabase.co/storage/v1/object/public/profile-photos/legacy.jpg", USER_ID)).toBeNull();
    expect(getOwnedProfilePhotoPath("https://example.com/avatar.jpg", USER_ID)).toBeNull();
  });
});
