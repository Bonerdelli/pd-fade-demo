import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@pd-fade/shared";
import { isPinnedToBottom, scrollToBottom } from "../lib/scroll-pin.js";

export function useScrollPin(messages: ChatMessage[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const handleScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    pinnedRef.current = isPinnedToBottom(element);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !pinnedRef.current) {
      return;
    }
    scrollToBottom(element);
  }, [messages]);

  return { containerRef, handleScroll };
}
