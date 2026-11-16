export type HueDoc = { path: string; text: string; error: string }

declare module 'claude-code' {
  interface PluginState {
    'hue-md': { doc: Shaped<HueDoc> }
  }
}
