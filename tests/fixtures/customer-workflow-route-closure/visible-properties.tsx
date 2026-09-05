export function VisibleProperties() {
  const cards = [
    { message: "Visible message copy" },
    { notice: "Visible notice copy" },
    { statusText: "Visible status copy" },
    { kind: "Hidden semantic kind" },
  ];
  return <div>{cards.length}</div>;
}
