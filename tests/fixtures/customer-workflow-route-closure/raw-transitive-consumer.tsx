import { customerWorkflowExactT } from "../../../src/lib/i18n/customer-workflow-auth-translations";
import { rawTransitiveBridge } from "./raw-transitive-bridge";

export function RawTransitiveConsumer({ locale }: { locale: string }) {
  return (
    <section>
      <h1>{customerWorkflowExactT(locale as never, "Sign in")}</h1>
      <p>{rawTransitiveBridge()}</p>
    </section>
  );
}
