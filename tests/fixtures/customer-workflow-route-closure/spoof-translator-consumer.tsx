import { customerWorkflowT } from "./spoof-translator-provider";

export default function SpoofTranslatorConsumer() {
  return <p>{customerWorkflowT()}</p>;
}
