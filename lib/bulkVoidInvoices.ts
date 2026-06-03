export interface BulkVoidSummary {
  succeeded: number;
  failed: number;
  failureReasons: string[];
}

export interface BulkVoidToast {
  tone: "success" | "warning" | "error";
  message: string;
}

function reasonToString(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "Unknown error";
}

export function summarizeBulkVoidResults(
  results: PromiseSettledResult<unknown>[],
): BulkVoidSummary {
  let succeeded = 0;
  const failureReasons: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      succeeded += 1;
    } else {
      failureReasons.push(reasonToString(r.reason));
    }
  }
  return {
    succeeded,
    failed: failureReasons.length,
    failureReasons,
  };
}

export function formatBulkVoidMessage(summary: BulkVoidSummary): BulkVoidToast {
  const { succeeded, failed } = summary;

  if (failed === 0) {
    return {
      tone: "success",
      message: `${succeeded} ${succeeded === 1 ? "invoice" : "invoices"} voided`,
    };
  }

  if (succeeded === 0) {
    return {
      tone: "error",
      message: `Failed to void ${failed} ${failed === 1 ? "invoice" : "invoices"}`,
    };
  }

  return {
    tone: "warning",
    message: `${succeeded} voided, ${failed} failed`,
  };
}
