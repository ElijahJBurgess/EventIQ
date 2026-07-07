import { useEffect } from "react";

const KEY = "ooo_last_version";

export type AppVersion = "v1" | "v2";

export function getLastVersion(): AppVersion {
  if (typeof window === "undefined") return "v1";
  return window.localStorage.getItem(KEY) === "v2" ? "v2" : "v1";
}

export function setLastVersion(v: AppVersion) {
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* ignore storage errors */
  }
}

/** Record which version the user is currently viewing. */
export function useRememberVersion(v: AppVersion) {
  useEffect(() => {
    setLastVersion(v);
  }, [v]);
}
