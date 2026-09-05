import { customerWorkflowExactT } from "../../../src/lib/i18n/customer-workflow-auth-translations";
import { rawTransitiveValue } from "./raw-transitive-provider";

const fakeFormatter = {
  map(value: string) {
    return value;
  },
  toLocaleString(value: string) {
    return value;
  },
};

export function RawSpoofMethodConsumer({ locale }: { locale: string }) {
  return (
    <section>
      <h1>{customerWorkflowExactT(locale as never, "Sign in")}</h1>
      <p>{fakeFormatter.map(rawTransitiveValue())}</p>
      <p>{fakeFormatter.toLocaleString(rawTransitiveValue())}</p>
    </section>
  );
}
