import { OpenCode } from "@opencode-ai/client/effect"
import { PermissionSaved } from "@opencode-ai/core/permission/saved"
import { SdkPlugins } from "@opencode-ai/core/plugin/sdk"
import { Tool } from "@opencode-ai/core/tool/tool"
import { createEmbeddedRoutes } from "@opencode-ai/server/routes"
import { Context, Effect, Layer, Scope } from "effect"
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/unstable/http"

export const create = Effect.fn("OpenCode.create")(function* () {
  const scope = yield* Scope.Scope
  const memoMap = yield* Layer.makeMemoMap
  const sdkHost = SdkPlugins.makeHost()
  const context = yield* Layer.buildWithMemoMap(
    Layer.mergeAll(PermissionSaved.defaultLayer, SdkPlugins.layerWithHost(sdkHost)),
    memoMap,
    scope,
  )
  const plugins = Context.get(context, SdkPlugins.Service)
  const permissions = Context.get(context, PermissionSaved.Service)
  const toolPluginPrefix = crypto.randomUUID()
  let toolPlugin = 0
  const web = yield* Effect.acquireRelease(
    Effect.sync(() =>
      HttpRouter.toWebHandler(
        createEmbeddedRoutes(sdkHost).pipe(
          HttpRouter.provideRequest(Layer.succeed(PermissionSaved.Service, permissions)),
          Layer.provide(HttpServer.layerServices),
        ),
        { disableLogger: true, memoMap },
      ),
    ),
    (web) => Effect.promise(web.dispose),
  )
  const fetch = Object.assign((input: RequestInfo | URL, init?: RequestInit) => web.handler(new Request(input, init)), {
    preconnect: () => undefined,
  }) satisfies typeof globalThis.fetch
  const client = yield* OpenCode.make({ baseUrl: "http://opencode.local" }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, fetch),
  )
  return {
    ...client,
    sessions: client.session,
    events: client.event,
    tools: {
      register: (tools: Readonly<Record<string, Tool.AnyTool>>) =>
        plugins.register({
          id: `sdk-tools-${toolPluginPrefix}-${toolPlugin++}`,
          effect: (ctx) => ctx.tool.register(tools).pipe(Effect.orDie),
        }),
    },
    // The embedded host contributes plugins through the ordinary discovery flow:
    // each plugin's `effect` runs inside every Location with the real
    // `PluginContext`, so `ctx.agent.transform` and every other hook behave exactly
    // as they do for a config-discovered plugin. Define agent profiles here at
    // startup, then select one per Session with `sessions.create({ agent })`.
    plugin: plugins.register,
  }
})

export type Interface = Effect.Success<ReturnType<typeof create>>

export class Service extends Context.Service<Service, Interface>()("@opencode-ai/sdk-next/OpenCode") {}

export const layer = Layer.effect(Service, create())
