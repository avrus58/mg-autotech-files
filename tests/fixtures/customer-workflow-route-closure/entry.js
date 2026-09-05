import { Helper } from "./helper.jsx";
export { bridge } from "./bridge";

export async function loadFixture() {
  return import("./dynamic.tsx");
}

export { Helper };
