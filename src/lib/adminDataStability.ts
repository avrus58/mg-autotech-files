export function hasAdminSnapshotRegression(
  previouslyVerifiedIds: Iterable<string>,
  incomingIds: Iterable<string>
) {
  const previous = new Set(previouslyVerifiedIds);
  if (previous.size === 0) return false;

  const incoming = new Set(incomingIds);
  if (incoming.size === 0) return true;

  let retained = 0;
  for (const id of previous) {
    if (incoming.has(id)) retained += 1;
  }

  return retained / previous.size < 0.75;
}
