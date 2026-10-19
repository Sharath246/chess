import { API_URL } from "../utils/url";

export async function getOnlinePlayers() {
  const sessionId = sessionStorage.getItem("sessionId");
  const response = await fetch(`${API_URL}/get_online`, {
    headers: {
      Authorization: `Bearer ${sessionId}`,
    },
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload.error || "Unable to find online players");
  }

  return payload;
}