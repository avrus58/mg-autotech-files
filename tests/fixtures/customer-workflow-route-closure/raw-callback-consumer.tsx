import { customerWorkflowExactT } from "../../../src/lib/i18n/customer-workflow-auth-translations";
import { rawTransitiveValue } from "./raw-transitive-provider";

export function RawCallbackConsumer({ locale }: { locale: string }) {
  return (
    <section>
      <h1>{customerWorkflowExactT(locale as never, "Sign in")}</h1>
      <p>{[0].map(() => rawTransitiveValue())}</p>
    </section>
  );
}
