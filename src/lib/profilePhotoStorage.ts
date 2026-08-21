export const PROFILE_PHOTO_BUCKET = "profile-photos";
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const extensionByMimeType: Record<(typeof ALLOWED_PROFILE_PHOTO_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedProfilePhotoType(type: string): type is (typeof ALLOWED_PROFILE_PHOTO_TYPES)[number] {
  return ALLOWED_PROFILE_PHOTO_TYPES.includes(type as (typeof ALLOWED_PROFILE_PHOTO_TYPES)[number]);
}

export function createProfilePhotoPath(userId: string, mimeType: (typeof ALLOWED_PROFILE_PHOTO_TYPES)[number]): string {
  return `${userId}/${crypto.randomUUID()}.${extensionByMimeType[mimeType]}`;
}

export function getOwnedProfilePhotoPath(publicUrl: string, userId: string): string | null {
  if (!publicUrl || !userId) return null;

  try {
    const marker = `/storage/v1/object/public/${PROFILE_PHOTO_BUCKET}/`;
    const pathname = new URL(publicUrl).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const encodedPath = pathname.slice(markerIndex + marker.length);
    const segments = encodedPath.split("/").map((segment) => decodeURIComponent(segment));
    if (segments.length !== 2 || segments[0] !== userId || !segments[1]) return null;
    return segments.join("/");
  } catch {
    return null;
  }
}
