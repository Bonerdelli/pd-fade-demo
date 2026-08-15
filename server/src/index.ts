import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import { createRunManager } from "./agent/index.js";
import { config } from "./config.js";
import { createDatabase, SessionStore } from "./db/index.js";
import { registerSessionRoutes } from "./http/index.js";
import { EventBus } from "./lib/event-bus.js";

export interface BuildServerOptions {
  dbPath?: string;
  agentDriver?: string;
}

export async function buildServer(options: BuildServerOptions = {}) {
  const db = createDatabase(options.dbPath ?? config.dbPath);
  const sessionStore = new SessionStore(db);
  const eventBus = new EventBus();
  const runManager = createRunManager(
    sessionStore,
    eventBus,
    options.agentDriver ?? config.agentDriver,
  );

  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => ({ ok: true }));
  registerSessionRoutes(app, { sessionStore, eventBus, runManager });

  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}

export async function startServer() {
  const port = config.port;
  const app = await buildServer();

  await app.listen({ port, host: "0.0.0.0" });
  return app;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
