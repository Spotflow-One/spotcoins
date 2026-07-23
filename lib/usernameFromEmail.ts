const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Sanitize an email local-part (or any raw string) into a valid Spotcoin username.
 * Pattern: 3–30 chars, letters/numbers/underscores only.
 */
export function sanitizeUsernameCandidate(raw: string): string {
  let cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (cleaned.length < 3) {
    cleaned = `${cleaned}user`.slice(0, 30);
    if (cleaned.length < 3) cleaned = "user";
  }

  return cleaned.slice(0, 30);
}

export function emailLocalPart(email: string): string {
  const local = email.trim().split("@")[0] ?? "";
  return local || email.trim();
}

export function usernameCandidateFromEmail(email: string): string {
  return sanitizeUsernameCandidate(emailLocalPart(email));
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/**
 * Pick a unique username in a workspace from an email, appending 2, 3, … on collision.
 */
export async function allocateUsernameFromEmail(
  email: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = usernameCandidateFromEmail(email);
  let candidate = base;
  let n = 2;
  while (await isTaken(candidate)) {
    const suffix = String(n);
    const maxBase = Math.max(1, 30 - suffix.length);
    candidate = `${base.slice(0, maxBase)}${suffix}`;
    n += 1;
    if (n > 9999) {
      candidate = sanitizeUsernameCandidate(`${base}${Date.now().toString(36)}`).slice(0, 30);
      break;
    }
  }
  return candidate;
}

export { USERNAME_PATTERN };
