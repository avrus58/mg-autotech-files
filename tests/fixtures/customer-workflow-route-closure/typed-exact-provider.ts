export function buildTypedExactFixture() {
  const rows: Array<{ label: string; detail: string }> = [];
  rows.push({ label: "Back", detail: "Try again" });

  return {
    title: "Customer Settings",
    rows,
  };
}
