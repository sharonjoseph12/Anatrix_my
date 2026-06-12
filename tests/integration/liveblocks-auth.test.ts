import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { downgradeObserverToken, getServerAuthToken } from "../../apps/web/src/lib/collab/liveblocks";

const OLD_ENV = { ...process.env };

function parseAuthBody(body: string): Record<string, unknown> {
  return JSON.parse(body) as Record<string, unknown>;
}

describe("Liveblocks auth token minting", () => {
  beforeEach(() => {
    process.env.LIVEBLOCKS_SECRET_KEY = "test_secret_12345_dummy_key_for_testing";
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it.skip("mints write-scoped room access", async () => {
    const response = await fetch("http://localhost:3000/api/collab/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: "collab-room-123" }),
    });
    const body = parseAuthBody(await response.text());

    expect(response.status).toBe(200);
    expect(typeof body.token).toBe("string");
  });

  it.skip("mints read-scoped observer access after downgrade", async () => {
    const response = await downgradeObserverToken("room-a", "observer-a");
    const body = parseAuthBody(response.body);

    expect(response.status).toBe(200);
    expect(typeof body.token).toBe("string");
  });
});
