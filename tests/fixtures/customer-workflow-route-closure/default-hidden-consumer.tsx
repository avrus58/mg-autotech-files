import { defaultHiddenValue } from "./default-hidden-provider";

export function DefaultHiddenConsumer() {
  return <p>{defaultHiddenValue()}</p>;
}
