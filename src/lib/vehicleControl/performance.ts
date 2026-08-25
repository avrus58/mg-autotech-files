function roundPerformanceValue(value: number) {
  return Math.round(value);
}

export function calculatePerformanceGain(stock: number | null, tuned: number | null) {
  if (stock == null || tuned == null || !Number.isFinite(stock) || !Number.isFinite(tuned)) return null;
  return roundPerformanceValue(tuned - stock);
}

export function calculateTunedFromGain(stock: number | null, gain: number | null) {
  if (stock == null || gain == null || !Number.isFinite(stock) || !Number.isFinite(gain)) return null;
  return roundPerformanceValue(stock + gain);
}

export function isWholePerformanceInput(value: string) {
  if (value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed);
}
