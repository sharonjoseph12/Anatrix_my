import { useState, useEffect } from "react";

export function LoginPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const [hasToken, setHasToken] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    function checkToken() {
      void chrome.storage.local.get("antarix:auth:token").then((res) => {
        const tokenPresent = Boolean(res["antarix:auth:token"]);
        setHasToken(tokenPresent);
        if (tokenPresent) onSignedIn();
      });
    }

    checkToken();
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes["antarix:auth:token"]) return;
      checkToken();
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [onSignedIn]);

  function openWebApp() {
    setOpening(true);
    const webApp =
      import.meta.env.VITE_WEB_APP_URL ??
      import.meta.env.VITE_APP_URL ??
      "http://localhost:3000";
    const url = `${webApp}/login?next=${encodeURIComponent("/extension/auth")}&extension=1`;
    chrome.tabs.create({ url });
    window.close();
  }

  if (hasToken) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 13 }}>
          Connected. If your session is stale, sign in again on the web app.
        </p>
        <button type="button" className="btn btn--ghost btn--block" onClick={openWebApp}>
          Open Antarix Web
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16 }}>Sign in to track</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Sign in on antarix.app to connect the extension. We&apos;ll keep you signed in here.
        </p>
      </div>
      <button
        type="button"
        className="btn btn--primary btn--block btn--lg"
        onClick={openWebApp}
        disabled={opening}
      >
        {opening ? "Opening…" : "Open Antarix"}
      </button>
    </div>
  );
}
