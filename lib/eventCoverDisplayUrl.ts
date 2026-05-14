/**
 * Event covers are stored as absolute URLs (from NEXT_PUBLIC_APP_URL at upload time).
 * Using that URL on another host (e.g. dev vs prod) loads the image cross-origin without
 * session cookies, so `/api/events/cover` fails. Use a same-origin path instead.
 */
export function eventCoverImgSrc(storedUrl: string | null | undefined): string | null {
  if (storedUrl == null) return null;
  const trimmed = String(storedUrl).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    if (u.pathname === "/api/events/cover") {
      const k = u.searchParams.get("k");
      if (k) {
        return `/api/events/cover?k=${encodeURIComponent(k)}`;
      }
    }
    if (u.pathname.startsWith("/uploads/events/")) {
      return `${u.pathname}${u.search}`;
    }
    return trimmed;
  } catch {
    if (trimmed.startsWith("/")) return trimmed;
    return trimmed;
  }
}
