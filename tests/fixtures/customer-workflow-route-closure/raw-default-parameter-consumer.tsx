import { rawTransitiveValue } from "./raw-transitive-provider";

function label(value = rawTransitiveValue()) {
  return value;
}

export function RawDefaultParameterConsumer() {
  return <p>{label()}</p>;
}
