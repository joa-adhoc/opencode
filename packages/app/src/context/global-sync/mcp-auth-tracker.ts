// Tracks MCP servers whose authorization URL was just opened via a direct
// window.open() from the "authenticate" click response, so the SSE-driven
// toast fallback (context/notification.tsx) can skip showing a redundant
// prompt for the same attempt.
const recentlyOpened = new Map<string, number>()
const TTL_MS = 10_000

export function markAuthorizationUrlOpened(mcpName: string) {
  recentlyOpened.set(mcpName, Date.now())
}

export function consumeRecentlyOpened(mcpName: string) {
  const at = recentlyOpened.get(mcpName)
  if (at === undefined) return false
  recentlyOpened.delete(mcpName)
  return Date.now() - at <= TTL_MS
}
