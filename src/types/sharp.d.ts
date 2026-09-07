// sharp 0.35.0 ships its full declarations but omits a `types` export condition.
// Keep the actual upstream types (not an `any` stub) until that export is fixed.
declare module "sharp" {
  const sharp: typeof import("../../node_modules/sharp/lib/index");
  export = sharp;
}
