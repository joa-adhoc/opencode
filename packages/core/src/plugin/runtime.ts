export * as PluginRuntime from "./runtime"

import { Context, Effect, Layer } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { Job } from "../job"
import { SessionV2 } from "../session"

export interface Interface {
  readonly session: Pick<
    SessionV2.Interface,
    "get" | "create" | "messages" | "prompt" | "resume" | "interrupt" | "synthetic"
  >
  readonly backgroundJob: Pick<Job.Interface, "start" | "wait" | "block" | "background" | "cancel">
}

export class Service extends Context.Service<Service, Interface>()("@opencode/PluginRuntime") {}

export interface Cell {
  runtime?: Interface
}

export const makeCell = (): Cell => ({})

const unavailable = <A, E, R>() => Effect.die("Plugin runtime is unavailable") as Effect.Effect<A, E, R>
const require = <A, E, R>(cell: Cell, f: (runtime: Interface) => Effect.Effect<A, E, R>) =>
  Effect.suspend(() => {
    const runtime = cell.runtime
    if (runtime === undefined) return unavailable<A, E, R>()
    return f(runtime)
  })

const defaultCell = makeCell()

export const layerWithCell = (cell: Cell) =>
  Layer.succeed(
    Service,
    Service.of({
      session: {
        get: (sessionID) => require(cell, (runtime) => runtime.session.get(sessionID)),
        create: (input) => require(cell, (runtime) => runtime.session.create(input)),
        messages: (input) => require(cell, (runtime) => runtime.session.messages(input)),
        prompt: (input) => require(cell, (runtime) => runtime.session.prompt(input)),
        resume: (sessionID) => require(cell, (runtime) => runtime.session.resume(sessionID)),
        interrupt: (sessionID) => require(cell, (runtime) => runtime.session.interrupt(sessionID)),
        synthetic: (input) => require(cell, (runtime) => runtime.session.synthetic(input)),
      },
      backgroundJob: {
        start: (input) => require(cell, (runtime) => runtime.backgroundJob.start(input)),
        wait: (input) => require(cell, (runtime) => runtime.backgroundJob.wait(input)),
        block: (input) => require(cell, (runtime) => runtime.backgroundJob.block(input)),
        background: (id) => require(cell, (runtime) => runtime.backgroundJob.background(id)),
        cancel: (id) => require(cell, (runtime) => runtime.backgroundJob.cancel(id)),
      },
    }),
  )

export const providerLayerWithCell = (cell: Cell) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const sessions = yield* SessionV2.Service
      const jobs = yield* Job.Service
      const runtime = {
        session: sessions,
        backgroundJob: jobs,
      } satisfies Interface
      cell.runtime = runtime
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (cell.runtime === runtime) cell.runtime = undefined
        }),
      )
    }),
  )

export const layer = layerWithCell(defaultCell)
export const providerLayer = providerLayerWithCell(defaultCell)

export const node = makeGlobalNode({ service: Service, layer, deps: [] })

export const providerNode = makeGlobalNode({
  name: "plugin-runtime-provider",
  layer: providerLayer,
  deps: [node, SessionV2.node, Job.node],
})
