import { customerWorkflowExactT } from "../../../src/lib/i18n/customer-workflow-auth-translations";
import { relayedProperty } from "./raw-property-bridge";

export function RawPropertyConsumer({ locale }: { locale: string }) {
  return (
    <section>
      <h1>{customerWorkflowExactT(locale as never, "Sign in")}</h1>
      <p>{relayedProperty}</p>
    </section>
  );
}
