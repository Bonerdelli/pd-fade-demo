export function sessionEventsPath(sessionId: string): string {
  return `/session/${sessionId}/events`;
}

export function sessionStatePath(sessionId: string): string {
  return `/session/${sessionId}/state`;
}

export function sessionMessagesPath(sessionId: string): string {
  return `/session/${sessionId}/messages`;
}

export function sessionCanvasPath(sessionId: string): string {
  return `/session/${sessionId}/canvas`;
}

export function sessionCancelRunPath(sessionId: string): string {
  return `/session/${sessionId}/runs/current/cancel`;
}
