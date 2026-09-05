import { customerWorkflowExactT } from "../../../src/lib/i18n/customer-workflow-auth-translations";
import { rawTransitiveValue } from "./raw-transitive-provider";

export function RawFormatterConsumer({ locale }: { locale: string }) {
  return (
    <section>
      <h1>{customerWorkflowExactT(locale as never, "Sign in")}</h1>
      <p>{String(rawTransitiveValue())}</p>
    </section>
  );
}
