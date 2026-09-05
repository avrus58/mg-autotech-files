import { customerWorkflowExactT as workflowExact } from "@/lib/i18n/customer-workflow-security-translations";
import { buildTypedExactFixture } from "./typed-exact-provider";

function ShadowedLiteral({
  locale,
  workflowExact,
}: {
  locale: "en" | "de";
  workflowExact: (locale: "en" | "de", source: string) => string;
}) {
  return <span>{workflowExact(locale, "Back")}</span>;
}

export function TypedExactConsumerShadowLiteral({
  locale,
}: {
  locale: "en" | "de";
}) {
  const fixture = buildTypedExactFixture();

  return (
    <section>
      <h1>{workflowExact(locale, fixture.title)}</h1>
      {fixture.rows.map((row) => (
        <p key={row.label}>
          {workflowExact(locale, row.label)}:{" "}
          {workflowExact(locale, row.detail)}
        </p>
      ))}
      <ShadowedLiteral locale={locale} workflowExact={workflowExact} />
    </section>
  );
}
