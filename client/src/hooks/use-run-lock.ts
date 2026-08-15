import { useAppStore, selectRunLock } from "../store/index.js";

export function useRunLock(): boolean {
  return useAppStore(selectRunLock);
}
