import type { McpStatus } from "@opencode-ai/sdk/v2/client"
import { markAuthorizationUrlOpened } from "./mcp-auth-tracker"

export async function toggleMcp(input: {
  name: string
  status: McpStatus["status"]
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  authenticate: () => Promise<{ authorizationUrl: string } | void>
  refresh: () => Promise<void>
}) {
  // Mark before the request goes out: the mcp.browser.open.failed SSE event
  // (published server-side as part of the same authenticate() call) can reach
  // an already-open event stream before this request's own response comes
  // back, so marking after the response would lose the race.
  if (input.status === "needs_auth") markAuthorizationUrlOpened(input.name)
  const result = await {
    connected: input.disconnect,
    needs_auth: input.authenticate,
    disabled: input.connect,
    failed: input.connect,
    needs_client_registration: input.connect,
  }[input.status]()
  if (result?.authorizationUrl) window.open(result.authorizationUrl, "_blank")
  await input.refresh()
}
