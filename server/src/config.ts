import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  port: Number(process.env.PORT ?? 3001),
  dbPath: process.env.DB_PATH ?? join(serverRoot, "data", "sessions.db"),
  agentDriver: process.env.AGENT_DRIVER ?? "mock",
} as const;
