import { AnthropicAgentDriver } from "./anthropic-driver.js";
import type { AgentDriver } from "./driver.js";
import { MockAgentDriver } from "./mock-driver.js";

export function createAgentDriver(driverName: string): AgentDriver {
  switch (driverName) {
    case "mock":
      return new MockAgentDriver();
    case "anthropic":
      return new AnthropicAgentDriver();
    default:
      throw new Error(`Unsupported agent driver: ${driverName}`);
  }
}
