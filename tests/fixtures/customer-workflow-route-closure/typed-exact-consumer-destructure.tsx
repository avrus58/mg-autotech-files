import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-security-translations";
import { buildTypedExactFixture } from "./typed-exact-provider";

export function TypedExactConsumerDestructure({
  locale,
}: {
  locale: "en" | "de";
}) {
  const fixture = buildTypedExactFixture();
  const { title: rawTitle } = fixture;

  return (
    <section>
      <h1>{customerWorkflowExactT(locale, fixture.title)}</h1>
      <span>{rawTitle}</span>
      {fixture.rows.map((row) => (
        <p key={row.label}>
          {customerWorkflowExactT(locale, row.label)}:{" "}
          {customerWorkflowExactT(locale, row.detail)}
        </p>
      ))}
    </section>
  );
}
