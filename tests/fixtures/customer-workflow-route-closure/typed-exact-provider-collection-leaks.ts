type Row = { label: string; detail: string };

export function initialCollectionRows() {
  const rows: Row[] = [{ label: "Back", detail: "Try again" }];
  return { title: "Customer Settings", rows };
}

export function aliasedCollectionPush() {
  const rows: Row[] = [];
  rows.push({ label: "Back", detail: "Try again" });
  const alias = rows;
  alias.push({ label: "Raw alias", detail: "Raw alias detail" });
  return { title: "Customer Settings", rows };
}

export function unshiftedCollectionRow() {
  const rows: Row[] = [];
  rows.push({ label: "Back", detail: "Try again" });
  rows.unshift({ label: "Raw unshift", detail: "Raw unshift detail" });
  return { title: "Customer Settings", rows };
}

export function assignedCollectionRow() {
  const rows: Row[] = [];
  rows.push({ label: "Back", detail: "Try again" });
  rows[0] = { label: "Raw assignment", detail: "Raw assignment detail" };
  return { title: "Customer Settings", rows };
}
