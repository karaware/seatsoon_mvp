const STORAGE_KEY = "anonymous_user_id";

export function getAnonymousUserId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existingId = window.localStorage.getItem(STORAGE_KEY);
  if (existingId) {
    return existingId;
  }

  const id = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
