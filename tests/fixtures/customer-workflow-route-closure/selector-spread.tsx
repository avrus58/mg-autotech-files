declare function customerWorkflowT(locale: string, key: unknown): string;

declare function overrideForFixture(): Record<string, string>;

function selectKey() {
  return { key: "creditsCount", ...overrideForFixture() };
}

export function SelectorSpread(locale: string) {
  return <p>{customerWorkflowT(locale, selectKey())}</p>;
}
