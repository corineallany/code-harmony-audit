import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { ConflictsPanel } from "@/components/ConflictsPanel";
import { useCurrentRole } from "@/hooks/useAuth";
import { downloadCsv, exportStamp, toCsv } from "@/lib/exports";
import { polesQuery, programsQuery, solicitationsQuery, STATUS_LABEL } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({
    meta: [
      { title: "Planning — COM ICC Le Mans" },
      {
        name: "description",
        content: "Planning calendrier unifié du pôle Communication : programmes, sollicitations, filtres et conflits.",
      },
    ],
  }),
  component: Planning,
});

type ViewMode = "month" | "week";
type Entry = {
  id: string;
  sourceId: string;
  kind: "program" | "solicitation";
  title: string;
  date: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  detail: string;
  programType: string | null;
  format: string | null;
  recurrence: string | null;
  importance: string | null;
  poleIds: string[];
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function Planning() {
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const poles = useQuery(polesQuery);
  const { isStaff } = useCurrentRole();

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [status, setStatus] = useState("all");
  const [programType, setProgramType] = useState("all");
  const [format, setFormat] = useState("all");
  const [recurrence, setRecurrence] = useState("all");
  const [importance, setImportance] = useState("all");
  const [pole, setPole] = useState("all");

  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);

  const allEntries = useMemo<Entry[]>(() => {
    const rows: Entry[] = [
      ...(programs.data ?? []).map((p) => ({
        id: `p-${p.id}`,
        sourceId: p.id,
        kind: "program" as const,
        title: p.title,
        date: p.start_date,
        endDate: p.end_date,
        startTime: p.start_time,
        endTime: p.end_time,
        status: p.status,
        detail: p.assignments.map((a) => poleName.get(a.pole_id)).filter(Boolean).join(" · ") || "Aucun pôle affecté",
        programType: p.program_type,
        format: p.format,
        recurrence: p.recurrence,
        importance: p.importance,
        poleIds: p.assignments.map((a) => a.pole_id),
      })),
      ...(solicitations.data ?? []).map((s) => ({
        id: `s-${s.id}`,
        sourceId: s.id,
        kind: "solicitation" as const,
        title: s.event_name ?? "Sollicitation",
        date: s.event_date,
        endDate: s.event_date,
        startTime: null,
        endTime: null,
        status: s.status,
        detail: s.requester ?? "Demandeur inconnu",
        programType: null,
        format: null,
        recurrence: null,
        importance: null,
        poleIds: s.target_pole_id ? [s.target_pole_id] : [],
      })),
    ];
    return rows.sort((a, b) => `${a.date ?? "9999"}${a.startTime ?? ""}`.localeCompare(`${b.date ?? "9999"}${b.startTime ?? ""}`));
  }, [programs.data, solicitations.data, poleName]);

  const entries = useMemo(
    () =>
      allEntries.filter((entry) => {
        if (status !== "all" && entry.status !== status) return false;
        if (programType !== "all" && entry.programType !== programType) return false;
        if (format !== "all" && entry.format !== format) return false;
        if (recurrence !== "all" && entry.recurrence !== recurrence) return false;
        if (importance !== "all" && entry.importance !== importance) return false;
        if (pole !== "all" && !entry.poleIds.includes(pole)) return false;
        return true;
      }),
    [allEntries, status, programType, format, recurrence, importance, pole],
  );

  const statusOptions = useMemo(() => [...new Set(allEntries.map((e) => e.status).filter(Boolean))], [allEntries]);
  const typeOptions = useMemo(() => [...new Set(allEntries.map((e) => e.programType).filter(Boolean))] as string[], [allEntries]);
  const formatOptions = useMemo(() => [...new Set(allEntries.map((e) => e.format).filter(Boolean))] as string[], [allEntries]);
  const recurrenceOptions = useMemo(() => [...new Set(allEntries.map((e) => e.recurrence).filter(Boolean))] as string[], [allEntries]);
  const importanceOptions = useMemo(() => [...new Set(allEntries.map((e) => e.importance).filter(Boolean))] as string[], [allEntries]);

  const visibleDates = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return monthGrid(anchor);
  }, [anchor, view]);

  const title = view === "month"
    ? anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : `${startOfWeek(anchor).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} — ${addDays(startOfWeek(anchor), 6).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;

  function move(direction: number) {
    setAnchor((current) => {
      const next = new Date(current);
      if (view === "month") next.setMonth(next.getMonth() + direction);
      else next.setDate(next.getDate() + 7 * direction);
      return next;
    });
  }

  function exportPlanning() {
    const rows = entries.filter((e) => e.date);
    downloadCsv(
      `icc-planning-${exportStamp()}.csv`,
      toCsv(rows, [
        { key: "date", label: "Date", value: (e) => e.date },
        { key: "heure", label: "Horaire", value: (e) => [e.startTime, e.endTime].filter(Boolean).join(" - ") },
        { key: "type", label: "Nature", value: (e) => (e.kind === "program" ? "Programme" : "Sollicitation") },
        { key: "titre", label: "Titre", value: (e) => e.title },
        { key: "statut", label: "Statut", value: (e) => STATUS_LABEL[e.status] ?? e.status },
        { key: "pole", label: "Pôle(s)", value: (e) => e.poleIds.map((id) => poleName.get(id) ?? id).join(" · ") },
        { key: "format", label: "Format", value: (e) => e.format },
        { key: "importance", label: "Importance", value: (e) => e.importance },
      ]),
    );
  }

  if (programs.isLoading || solicitations.isLoading) {
    return (
      <AppShell title="Planning">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Planning" subtitle="Calendrier général — programmes, sollicitations, filtres et conflits">
      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={view === "month" ? "default" : "outline"} onClick={() => setView("month")}>Mois</Button>
                <Button size="sm" variant={view === "week" ? "default" : "outline"} onClick={() => setView("week")}>Semaine</Button>
                <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>Aujourd’hui</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => window.print()}>Imprimer / PDF</Button>
                <Button size="sm" variant="outline" onClick={exportPlanning}>Excel / CSV</Button>
                {isStaff ? <Button size="sm" asChild><Link to="/administration">＋ Nouveau programme</Link></Button> : null}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">Tous les statuts</option>
                {statusOptions.map((v) => <option key={v} value={v}>{STATUS_LABEL[v] ?? v}</option>)}
              </select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={programType} onChange={(e) => setProgramType(e.target.value)}>
                <option value="all">Tous les types</option>
                {typeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="all">Tous les formats</option>
                {formatOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                <option value="all">Toutes récurrences</option>
                {recurrenceOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={importance} onChange={(e) => setImportance(e.target.value)}>
                <option value="all">Toute importance</option>
                {importanceOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={pole} onChange={(e) => setPole(e.target.value)}>
                <option value="all">Tous les pôles</option>
                {(poles.data ?? []).filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {isStaff ? <ConflictsPanel limit={6} /> : null}

        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button size="sm" variant="outline" onClick={() => move(-1)}>←</Button>
            <h2 className="text-center text-lg font-black capitalize text-icc-violet">{title}</h2>
            <Button size="sm" variant="outline" onClick={() => move(1)}>→</Button>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {DAY_LABELS.map((day) => <div key={day} className="bg-muted px-1 py-2 text-center text-[10px] font-black uppercase sm:text-xs">{day}</div>)}
            {visibleDates.map((date) => {
              const ds = isoDate(date);
              const dayEntries = entries.filter((entry) => entry.date && entry.date <= ds && (entry.endDate ?? entry.date) >= ds);
              const muted = view === "month" && date.getMonth() !== anchor.getMonth();
              const today = ds === isoDate(new Date());
              return (
                <div key={ds} className={`min-h-28 bg-card p-1.5 sm:min-h-36 sm:p-2 ${muted ? "opacity-45" : ""}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${today ? "bg-icc-violet text-white" : ""}`}>{date.getDate()}</span>
                    {isStaff ? <Link to="/administration" title={`Créer un programme le ${ds}`} className="text-xs font-black text-icc-violet hover:underline">＋</Link> : null}
                  </div>
                  <div className="space-y-1">
                    {dayEntries.slice(0, view === "week" ? 8 : 4).map((entry) => (
                      <Link key={`${entry.id}-${ds}`} to={entry.kind === "program" ? "/programmes" : "/sollicitations"} className={`block rounded-md border px-1.5 py-1 text-[9px] leading-tight transition-colors hover:border-icc-violet sm:text-[10px] ${entry.kind === "program" ? "bg-icc-violet/5" : "bg-icc-yellow/10"}`}>
                        <span className="block truncate font-black">{entry.startTime ? `${entry.startTime.slice(0, 5)} · ` : ""}{entry.title}</span>
                        <span className="block truncate text-muted-foreground">{STATUS_LABEL[entry.status] ?? entry.status}</span>
                      </Link>
                    ))}
                    {dayEntries.length > (view === "week" ? 8 : 4) ? <p className="text-[9px] font-bold text-muted-foreground">+ {dayEntries.length - (view === "week" ? 8 : 4)} autre(s)</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {entries.length === 0 ? <EmptyState title="Aucun élément avec ces filtres" description="Modifiez les filtres ou créez un nouveau programme." /> : (
          <div className="space-y-2">
            <h3 className="text-sm font-black text-icc-violet">Liste chronologique complémentaire</h3>
            {entries.slice(0, 20).map((entry) => (
              <Link key={entry.id} to={entry.kind === "program" ? "/programmes" : "/sollicitations"} className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-3 hover:border-icc-violet/40 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.kind === "program" ? "default" : "outline"}>{entry.kind === "program" ? "Programme" : "Sollicitation"}</Badge>
                    <span className="font-bold">{entry.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>
                </div>
                <div className="text-xs sm:text-right">
                  <p className="font-bold">{entry.date ?? "Date à définir"}{entry.startTime ? ` · ${entry.startTime.slice(0, 5)}` : ""}</p>
                  <p className="text-muted-foreground">{STATUS_LABEL[entry.status] ?? entry.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
