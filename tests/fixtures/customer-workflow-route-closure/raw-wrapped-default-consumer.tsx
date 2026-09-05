import { rawTransitiveValue } from "./raw-transitive-provider";

function label(value = rawTransitiveValue()) {
  return value;
}

export function RawWrappedDefaultConsumer() {
  return <p>{label((undefined as undefined))}</p>;
}
