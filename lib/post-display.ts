export function remainingMinutes(expiresAt: string, now: number) {
  const diffMs = new Date(expiresAt).getTime() - now;
  return Math.max(0, Math.ceil(diffMs / 60_000));
}

export function shortPostCode(id: string) {
  return id.replace(/-/g, "").slice(0, 4).toUpperCase();
}
