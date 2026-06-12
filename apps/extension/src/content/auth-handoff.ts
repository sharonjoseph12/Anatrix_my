// Receives session tokens posted by the web app's /extension/auth page
// and persists them for the popup + service worker.

const TOKEN_KEY = "antarix:auth:token";
const REFRESH_KEY = "antarix:auth:refresh";
const API_BASE_KEY = "antarix:auth:apiBase";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "antarix:auth-handoff") return;

  const { accessToken, refreshToken, apiBase } = event.data as {
    accessToken?: string;
    refreshToken?: string;
    apiBase?: string;
  };
  if (!accessToken) return;

  const payload: Record<string, string> = {
    [TOKEN_KEY]: accessToken,
  };
  if (refreshToken) payload[REFRESH_KEY] = refreshToken;
  if (apiBase) payload[API_BASE_KEY] = apiBase;

  void chrome.storage.local.set(payload);
});
