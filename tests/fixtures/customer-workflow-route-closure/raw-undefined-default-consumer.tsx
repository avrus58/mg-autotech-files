import { rawTransitiveValue } from "./raw-transitive-provider";

function label(value = rawTransitiveValue()) {
  return value;
}

export function RawUndefinedDefaultConsumer() {
  return <p>{label(undefined)}</p>;
}
