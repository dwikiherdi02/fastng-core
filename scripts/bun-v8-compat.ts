/**
 * Bun preload shim: `mongodb`/`bson` call `v8.startupSnapshot.isBuildingSnapshot()`
 * (see node_modules/bson/lib/bson.cjs) to reset ObjectId state after a V8 startup
 * snapshot is restored. Bun has not implemented this API yet and throws
 * `NotImplementedError` the moment it's *called* (unlike a plain `undefined`, which
 * bson's optional chaining would safely skip). This turns the call into a no-op so
 * importing mongoose/mongodb under Bun doesn't crash. Safe under Node too — this file
 * is only loaded when running via Bun (see bunfig.toml `preload`).
 * Remove once Bun implements `node:v8` startupSnapshot APIs.
 */
const v8 = process.getBuiltinModule?.('v8') as
  | { startupSnapshot?: { isBuildingSnapshot?: () => boolean } }
  | undefined

if (v8?.startupSnapshot) {
  try {
    v8.startupSnapshot.isBuildingSnapshot()
  } catch {
    Object.defineProperty(v8.startupSnapshot, 'isBuildingSnapshot', {
      value: () => false,
      configurable: true,
    })
  }
}
