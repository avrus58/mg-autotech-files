export function buildTypedExactFixture() {
  const rows: Array<{ label: string; detail: string }> = [];
  rows.push({ label: "Back", detail: "Try again" });
  const override = { title: "Raw override" };

  return {
    ...override,
    rows,
  };
}
