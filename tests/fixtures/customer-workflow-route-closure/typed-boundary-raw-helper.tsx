import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import {
  boundValue,
  nestedValue,
  objectPayload,
  payload,
} from "./raw-exported-payload";

export function TypedBoundaryRawHelper({ locale }: { locale: "en" | "de" }) {
  return (
    <div title={customerWorkflowExactT(locale, "Back")}>
      <p>{payload}</p>
      <p>{objectPayload.value}</p>
      <p>{boundValue()}</p>
      <p>{nestedValue()}</p>
    </div>
  );
}
