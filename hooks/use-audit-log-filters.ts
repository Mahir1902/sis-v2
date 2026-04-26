import { useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";

const ALL_FILTER_VALUE = "__all__";

type AuditLog = Doc<"auditLogs">;

export function useAuditLogFilters(logs: AuditLog[] | undefined) {
  const [actionFilter, setActionFilter] = useState<string>(ALL_FILTER_VALUE);
  const [entityTypeFilter, setEntityTypeFilter] =
    useState<string>(ALL_FILTER_VALUE);

  const entityTypeOptions = useMemo(() => {
    if (!logs) return [];
    const unique = [...new Set(logs.map((log) => log.entityType))];
    unique.sort();
    return unique;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      if (actionFilter !== ALL_FILTER_VALUE && log.action !== actionFilter) {
        return false;
      }
      if (
        entityTypeFilter !== ALL_FILTER_VALUE &&
        log.entityType !== entityTypeFilter
      ) {
        return false;
      }
      return true;
    });
  }, [logs, actionFilter, entityTypeFilter]);

  return {
    filteredLogs,
    actionFilter,
    setActionFilter,
    entityTypeFilter,
    setEntityTypeFilter,
    entityTypeOptions,
    allFilterValue: ALL_FILTER_VALUE,
  };
}
