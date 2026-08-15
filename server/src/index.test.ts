import { describe, expect, it } from "vitest";
import { buildServer } from "./index.js";

describe("buildServer", () => {
  it("exposes a health endpoint", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });
});
