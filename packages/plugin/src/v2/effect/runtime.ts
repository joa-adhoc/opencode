import type { Effect } from "effect"

type RuntimeEffect = Effect.Effect<any, any, any>

export interface SessionDomain {
  readonly get: (...args: any[]) => RuntimeEffect
  readonly create: (...args: any[]) => RuntimeEffect
  readonly messages: (...args: any[]) => RuntimeEffect
  readonly prompt: (...args: any[]) => RuntimeEffect
  readonly resume: (...args: any[]) => RuntimeEffect
  readonly interrupt: (...args: any[]) => RuntimeEffect
  readonly synthetic: (...args: any[]) => RuntimeEffect
}

export interface BackgroundJobDomain {
  readonly start: (...args: any[]) => RuntimeEffect
  readonly wait: (...args: any[]) => RuntimeEffect
  readonly block: (...args: any[]) => RuntimeEffect
  readonly background: (...args: any[]) => RuntimeEffect
  readonly cancel: (...args: any[]) => RuntimeEffect
}
