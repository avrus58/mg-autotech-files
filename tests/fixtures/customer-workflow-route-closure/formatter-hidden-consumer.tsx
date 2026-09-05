import { customerWorkflowExactT } from "../../../src/lib/i18n/customer-workflow-auth-translations";
import { formatterHiddenValue } from "./formatter-hidden-provider";

export function FormatterHiddenConsumer({ locale }: { locale: string }) {
  return (
    <section>
      <h1>{customerWorkflowExactT(locale as never, "Sign in")}</h1>
      <p>{formatterHiddenValue()}</p>
    </section>
  );
}
