export const API_BASE = "/api";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
