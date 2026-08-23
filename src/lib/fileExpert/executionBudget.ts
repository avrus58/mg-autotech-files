export const fileExpertRouteMaxDurationSeconds = 60;
export const fileExpertRouteOperationBudgetMs = 48_000;
export const fileExpertPostAnalyzerReserveMs = 8_000;
export const fileExpertSimilarityBudgetMs = 1_000;
export const fileExpertAiReportBudgetMs = 3_500;
export const fileExpertCompletionReserveMs = 3_000;
export const fileExpertCleanupMaxDurationMs = 8_000;
export const fileExpertCleanupDeadlineOffsetMs = 8_000;

export class FileExpertAnalysisDeadlineError extends Error {
  constructor() {
    super("Analysis capacity is temporarily unavailable.");
    this.name = "FileExpertAnalysisDeadlineError";
  }
}

export function boundedFileExpertDeadline(input: {
  absoluteDeadlineAt: number;
  maximumDurationMs: number;
  reserveMs?: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  return Math.min(
    now + input.maximumDurationMs,
    input.absoluteDeadlineAt - (input.reserveMs ?? 0)
  );
}

export function requireFileExpertBudget(deadlineAt: number, reserveMs = 0) {
  if (deadlineAt - Date.now() <= reserveMs) throw new FileExpertAnalysisDeadlineError();
}

export function fileExpertCleanupTimeoutMs(operationDeadlineAt: number, now = Date.now()) {
  return Math.max(
    1,
    Math.min(
      fileExpertCleanupMaxDurationMs,
      operationDeadlineAt + fileExpertCleanupDeadlineOffsetMs - now
    )
  );
}

export async function settleFileExpertOperationBefore<T>(
  operation: Promise<T>,
  deadlineAt: number
) {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) throw new FileExpertAnalysisDeadlineError();

  let timeout: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new FileExpertAnalysisDeadlineError()), remainingMs);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
