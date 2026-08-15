import Fastify from "fastify";
import { fileURLToPath } from "node:url";

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}

export async function startServer() {
  const port = Number(process.env.PORT ?? 3001);
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
