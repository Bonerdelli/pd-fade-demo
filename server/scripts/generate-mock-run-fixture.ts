import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDatabase } from "../src/db/database.js";
import { SessionStore } from "../src/db/session-store.js";
import { MockAgentDriver } from "../src/agent/mock-driver.js";

const db = createDatabase(":memory:");
const store = new SessionStore(db);
const driver = new MockAgentDriver();
const runId = "run-mock-1";

await driver.run(
  {
    sessionId: "fixture-session",
    runId,
    userMessage: "show berlin",
    userState: store.getUserState("fixture-session"),
    agentState: store.getAgentState("fixture-session"),
    signal: new AbortController().signal,
  },
  async (event) => store.appendEvent("fixture-session", event),
);

const events = store.getEventsAfter("fixture-session", 0);
const target = resolve(import.meta.dirname, "../../client/src/store/fixtures/mock-run-events.json");
writeFileSync(target, JSON.stringify(events, null, 2));
db.close();
