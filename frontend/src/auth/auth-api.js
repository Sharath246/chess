import { API_URL } from "../utils/url";

async function request(path, credentials) {
  const sessionId = sessionStorage.getItem("sessionId");
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}),
    },
    body: JSON.stringify(credentials),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to complete the request");
  }

  return payload;
}

export function login(credentials) {
  return request("/login", credentials);
}

export function register(credentials) {
  return request("/register_user", credentials);
}

export function guestLogin() {
  return fetch(`${API_URL}/guest_login`, { method: "POST" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Unable to continue as guest");
      }
      return payload;
    });
}

export function storeSession(user) {
  sessionStorage.setItem("sessionId", user.sessionId);
  sessionStorage.setItem("username", user.username);
}
