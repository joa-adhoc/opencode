export * as SdkPlugins from "./sdk"

import type { Plugin } from "@opencode-ai/plugin/v2/effect"
import { Context, Effect, Layer } from "effect"
import { makeGlobalNode } from "../effect/app-node"

export type Host = symbol

export const makeHost = (): Host => Symbol("SdkPlugins.host")

const defaultHost = makeHost()
const registered = new Map<Host, Map<string, Plugin>>()

/**
 * Holds the plugins an embedder (the `@opencode-ai/sdk-next` host) contributes,
 * so `PluginInternal` can add them on every Location boot through the ordinary
 * `ctx.plugin.add` seam — the same path `ConfigExternalPlugin` uses for plugins
 * discovered from config. A plugin registered after a Location has booted only
 * applies to Locations booted afterward, matching config-plugin timing;
 * embedders register at startup before creating Sessions.
 *
 * This registry is process-shared because `LocationServiceMap` builds Location
 * layers lazily in a nested graph. Entries are partitioned by an explicit host
 * token so embedded instances do not see each other's contributions.
 */
export interface Interface {
  readonly register: (plugin: Plugin) => Effect.Effect<void>
  readonly all: () => readonly Plugin[]
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SdkPlugins") {}

export const layerWithHost = (host: Host) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          registered.delete(host)
        }),
      )
      return Service.of({
        register: (plugin) =>
          Effect.sync(() => {
            const plugins = registered.get(host) ?? new Map<string, Plugin>()
            plugins.set(plugin.id, plugin)
            registered.set(host, plugins)
          }),
        all: () => [...(registered.get(host)?.values() ?? [])],
      })
    }),
  )

export const layer = layerWithHost(defaultHost)

export const node = makeGlobalNode({ service: Service, layer, deps: [] })
