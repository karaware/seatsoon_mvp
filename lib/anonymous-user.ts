const STORAGE_KEY = "anonymous_user_id";

export function getAnonymousUserId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existingId = window.localStorage.getItem(STORAGE_KEY);
  if (existingId) {
    return existingId;
  }

  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
