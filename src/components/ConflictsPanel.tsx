import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { EmptyState } from "@/components/AppShell";
import { CONFLICT_LABEL, detectConflicts, type AvailabilityRow, type Conflict } from "@/lib/conflicts";
import { availabilityQuery, formatDate, membersQuery, programsQuery } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SEVERITY_VARIANT: Record<Conflict["severity"], "destructive" | "default" | "outline"> = {
  high: "destructive",
  medium: "default",
  low: "outline",
};

export function useConflicts() {
  const programs = useQuery(programsQuery);
  const members = useQuery(membersQuery);
  const availability = useQuery(availabilityQuery);

  const conflicts = useMemo(
    () =>
      detectConflicts(
        programs.data ?? [],
        members.data?.members ?? [],
        (availability.data ?? []) as AvailabilityRow[],
      ),
    [programs.data, members.data, availability.data],
  );

  return {
    conflicts,
    loading: programs.isLoading || members.isLoading || availability.isLoading,
  };
}

export function ConflictsPanel({ limit }: { limit?: number }) {
  const { conflicts, loading } = useConflicts();
  const shown = limit ? conflicts.slice(0, limit) : conflicts;
  const critical = conflicts.filter((c) => c.severity === "high").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {critical > 0 ? (
            <AlertTriangle className="size-4 text-destructive" />
          ) : (
            <CheckCircle2 className="size-4 text-primary" />
          )}
          Conflits de planning
        </CardTitle>
        <Badge variant={critical > 0 ? "destructive" : "outline"}>
          {conflicts.length} détecté{conflicts.length > 1 ? "s" : ""}
        </Badge>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState title="Aucun conflit détecté" description="Créneaux, affectations et disponibilités sont cohérents." />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((conflict) => (
              <li key={conflict.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[conflict.severity]}>{CONFLICT_LABEL[conflict.kind]}</Badge>
                    <p className="truncate font-medium">{conflict.programTitle}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{conflict.message}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground sm:text-right">{formatDate(conflict.date)}</p>
              </li>
            ))}
          </ul>
        )}
        {limit && conflicts.length > limit ? (
          <p className="pt-3 text-xs text-muted-foreground">
            + {conflicts.length - limit} autre(s) conflit(s) — voir l’écran Conflits.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
