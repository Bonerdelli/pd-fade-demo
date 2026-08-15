import { ChatComposer } from "./ChatComposer.js";
import { ChatDebugModeToggle } from "./ChatDebugModeToggle.js";
import { ChatHeader } from "./ChatHeader.js";
import { MessageList } from "./MessageList.js";
import { RunStatusBanner } from "./RunStatusBanner.js";

export function ChatPanel() {
  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <ChatHeader />
      <RunStatusBanner />
      <MessageList />
      <ChatComposer />
      <ChatDebugModeToggle />
    </section>
  );
}
