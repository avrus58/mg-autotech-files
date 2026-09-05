import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-security-translations";
import { buildTypedExactFixture } from "./typed-exact-provider";

export function TypedExactConsumerShadow({
  locale,
  customerWorkflowExactT,
}: {
  locale: "en" | "de";
  customerWorkflowExactT: (locale: "en" | "de", source: string) => string;
}) {
  const fixture = buildTypedExactFixture();

  return (
    <section>
      <h1>{customerWorkflowExactT(locale, fixture.title)}</h1>
      {fixture.rows.map((row) => (
        <p key={row.label}>
          {customerWorkflowExactT(locale, row.label)}:{" "}
          {customerWorkflowExactT(locale, row.detail)}
        </p>
      ))}
    </section>
  );
}
