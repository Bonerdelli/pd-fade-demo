export function createDebouncer(delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    schedule(task: () => void) {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        task();
      }, delayMs);
    },
    cancel() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

export function createCoalescingFlusher<T>(flushDelayMs: number, flush: (values: Map<string, T>) => void) {
  const pending = new Map<string, T>();
  const debouncer = createDebouncer(flushDelayMs);

  return {
    push(key: string, value: T) {
      pending.set(key, value);
      debouncer.schedule(() => {
        const snapshot = new Map(pending);
        pending.clear();
        flush(snapshot);
      });
    },
    cancel() {
      debouncer.cancel();
      pending.clear();
    },
  };
}
