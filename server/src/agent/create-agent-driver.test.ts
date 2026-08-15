import { describe, expect, it } from "vitest";
import { AnthropicAgentDriver, createAnthropicClient } from "./anthropic-driver.js";
import { createAgentDriver } from "./create-agent-driver.js";
import { MockAgentDriver } from "./mock-driver.js";

describe("createAgentDriver", () => {
  it("selects mock driver by default name", () => {
    const driver = createAgentDriver("mock");
    expect(driver).toBeInstanceOf(MockAgentDriver);
  });

  it("selects anthropic driver when requested", () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    const driver = createAgentDriver("anthropic");
    expect(driver).toBeInstanceOf(AnthropicAgentDriver);

    if (previous) {
      process.env.ANTHROPIC_API_KEY = previous;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("throws for unsupported driver names", () => {
    expect(() => createAgentDriver("unknown")).toThrow(/Unsupported agent driver/);
  });
});

describe("createAnthropicClient", () => {
  it("requires ANTHROPIC_API_KEY", () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => createAnthropicClient()).toThrow(/ANTHROPIC_API_KEY/);

    if (previous) {
      process.env.ANTHROPIC_API_KEY = previous;
    }
  });
});
