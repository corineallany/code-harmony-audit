import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { downloadCsv, exportStamp, toCsv } from "@/lib/exports";
import { polesQuery, programsQuery } from "@/lib/icc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({
    meta: [
      { title: "Planning — COM ICC Le Mans" },
      { name: "description", content: "Calendrier des programmes du pôle Communication, avec vues Mois/Semaine et filtres métier." },
    ],
  }),
  component: Planning,
});

type ViewMode = "month" | "week";
type Entry = {
  id: string;
  title: string;
  date: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  programType: string | null;
  format: string | null;
  recurrence: string | null;
  importance: string | null;
  poleIds: string[];
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const STATUS_OPTIONS = [["confirmed", "Confirmé"], ["unconfirmed", "Non confirmé"], ["postponed", "Reporté"], ["cancelled", "Annulé"]] as const;
const TYPE_OPTIONS = [["eglise", "Église"], ["corporate", "Corporate"], ["invite", "Autre église / Invitation"], ["com", "Interne Com"]] as const;
const FORMAT_OPTIONS = [["presentiel", "Présentiel"], ["online", "En ligne"], ["both", "Présentiel + En ligne"], ["deplacement", "Déplacement"], ["deplacement_connecte", "Déplacement + Connecté"]] as const;
const RECURRENCE_OPTIONS = [["ponctuel", "Ponctuel"], ["hebdo", "Hebdomadaire"], ["bihebdo", "Une semaine sur 2"], ["bimensuel", "Bimensuel"], ["mensuel", "Mensuel"], ["trimestriel", "Trimestriel"], ["annuel", "Annuel"]] as const;
const IMMINENCE_OPTIONS = [["urgent", "Urgent · 48 h"], ["soon", "À venir · 7 jours"], ["month", "À venir · 30 jours"], ["later", "Plus tard"], ["past", "Passé"]] as const;
const IMPORTANCE_OPTIONS = [["critical", "Critique"], ["high", "Importante"], ["normal", "Normale"], ["low", "Faible"]] as const;
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS) as Record<string, string>;

// Code couleur fidèle à l'ancienne version validée.
const STATUS_STYLE: Record<string, string> = {
  confirmed: "border-green-200 bg-green-100 text-green-800 hover:border-green-400",
  unconfirmed: "border-amber-200 bg-amber-100 text-amber-900 hover:border-amber-400",
  postponed: "border-blue-200 bg-blue-100 text-blue-800 hover:border-blue-400",
  cancelled: "border-red-200 bg-red-100 text-red-800 hover:border-red-400",
};

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfWeek(date: Date) {
  const copy = new Date(date); copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); copy.setHours(12, 0, 0, 0); return copy;
}
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function monthGrid(anchor: Date) { const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12); const start = startOfWeek(first); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); }
function matchesImminence(value: string | null, filter: string) {
  if (filter === "all") return true;
  if (!value) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((new Date(`${value}T12:00:00`).getTime() - today.getTime()) / 86_400_000);
  if (filter === "past") return diff < 0;
  if (filter === "urgent") return diff >= 0 && diff <= 2;
  if (filter === "soon") return diff >= 0 && diff <= 7;
  if (filter === "month") return diff >= 0 && diff <= 30;
  if (filter === "later") return diff > 30;
  return true;
}

function Planning() {
  const programs = useQuery(programsQuery);
  const poles = useQuery(polesQuery);
  const { isStaff } = useCurrentRole();
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [status, setStatus] = useState("all");
  const [programType, setProgramType] = useState("all");
  const [format, setFormat] = useState("all");
  const [recurrence, setRecurrence] = useState("all");
  const [imminence, setImminence] = useState("all");
  const [importance, setImportance] = useState("all");

  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);
  const allEntries = useMemo<Entry[]>(() => (programs.data ?? []).map((p) => ({
    id: p.id, title: p.title, date: p.start_date, endDate: p.end_date, startTime: p.start_time, endTime: p.end_time,
    status: p.status, programType: p.program_type, format: p.format, recurrence: p.recurrence, importance: p.importance,
    poleIds: p.assignments.map((a) => a.pole_id),
  })).sort((a, b) => `${a.date ?? "9999"}${a.startTime ?? ""}`.localeCompare(`${b.date ?? "9999"}${b.startTime ?? ""}`)), [programs.data]);

  const entries = useMemo(() => allEntries.filter((e) =>
    (status === "all" || e.status === status) &&
    (programType === "all" || e.programType === programType) &&
    (format === "all" || e.format === format) &&
    (recurrence === "all" || e.recurrence === recurrence) &&
    matchesImminence(e.date, imminence) &&
    (importance === "all" || e.importance === importance)
  ), [allEntries, status, programType, format, recurrence, imminence, importance]);

  const visibleDates = useMemo(() => view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)) : monthGrid(anchor), [anchor, view]);
  const title = view === "month" ? anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : `${startOfWeek(anchor).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} — ${addDays(startOfWeek(anchor), 6).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;

  function move(direction: number) { setAnchor((d) => { const n = new Date(d); view === "month" ? n.setMonth(n.getMonth() + direction) : n.setDate(n.getDate() + 7 * direction); return n; }); }
  function resetFilters() { setStatus("all"); setProgramType("all"); setFormat("all"); setRecurrence("all"); setImminence("all"); setImportance("all"); }
  function exportPlanning() {
    const rows = entries.filter((e) => e.date);
    downloadCsv(`icc-planning-${exportStamp()}.csv`, toCsv(rows, [
      { key: "date", label: "Date", value: (e) => e.date },
      { key: "heure", label: "Horaire", value: (e) => [e.startTime, e.endTime].filter(Boolean).join(" - ") },
      { key: "titre", label: "Programme", value: (e) => e.title },
      { key: "statut", label: "Statut", value: (e) => STATUS_LABEL[e.status] ?? e.status },
      { key: "type", label: "Type", value: (e) => TYPE_OPTIONS.find(([v]) => v === e.programType)?.[1] ?? e.programType },
      { key: "format", label: "Format", value: (e) => FORMAT_OPTIONS.find(([v]) => v === e.format)?.[1] ?? e.format },
      { key: "recurrence", label: "Récurrence", value: (e) => RECURRENCE_OPTIONS.find(([v]) => v === e.recurrence)?.[1] ?? e.recurrence },
      { key: "importance", label: "Importance", value: (e) => IMPORTANCE_OPTIONS.find(([v]) => v === e.importance)?.[1] ?? e.importance },
      { key: "poles", label: "Pôle(s)", value: (e) => e.poleIds.map((id) => poleName.get(id) ?? id).join(" · ") },
    ]));
  }

  if (programs.isLoading) return <AppShell title="Planning"><div className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div></AppShell>;

  return <AppShell title="Planning" subtitle="Calendrier des programmes">
    <div className="space-y-5">
      <Card><CardContent className="space-y-4 p-4">
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
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Tous les statuts</option>{STATUS_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={programType} onChange={(e) => setProgramType(e.target.value)}><option value="all">Tous les types</option>{TYPE_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={format} onChange={(e) => setFormat(e.target.value)}><option value="all">Tous les formats</option>{FORMAT_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}><option value="all">Toutes les récurrences</option>{RECURRENCE_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={imminence} onChange={(e) => setImminence(e.target.value)}><option value="all">Toute imminence</option>{IMMINENCE_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={importance} onChange={(e) => setImportance(e.target.value)}><option value="all">Toute importance</option>{IMPORTANCE_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-muted-foreground">
            {STATUS_OPTIONS.map(([value, label]) => <span key={value} className="inline-flex items-center gap-1.5"><span className={`size-3 rounded-sm border ${STATUS_STYLE[value]}`} />{label}</span>)}
          </div>
          <Button size="sm" variant="ghost" onClick={resetFilters}>Réinitialiser les filtres</Button>
        </div>
      </CardContent></Card>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="mb-4 flex items-center justify-between gap-3"><Button size="sm" variant="outline" onClick={() => move(-1)}>←</Button><h2 className="text-center text-lg font-black capitalize text-icc-violet">{title}</h2><Button size="sm" variant="outline" onClick={() => move(1)}>→</Button></div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {DAY_LABELS.map((day) => <div key={day} className="bg-muted px-1 py-2 text-center text-[10px] font-black uppercase sm:text-xs">{day}</div>)}
          {visibleDates.map((date) => {
            const ds = isoDate(date);
            const dayEntries = entries.filter((e) => e.date && e.date <= ds && (e.endDate ?? e.date) >= ds);
            const muted = view === "month" && date.getMonth() !== anchor.getMonth();
            const today = ds === isoDate(new Date());
            const limit = view === "week" ? 8 : 4;
            return <div key={ds} className={`min-h-28 bg-card p-1.5 sm:min-h-36 sm:p-2 ${muted ? "opacity-45" : ""}`}>
              <div className="mb-1 flex items-center justify-between"><span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${today ? "bg-icc-violet text-white" : ""}`}>{date.getDate()}</span>{isStaff ? <Link to="/administration" title={`Créer un programme le ${ds}`} className="text-xs font-black text-icc-violet hover:underline">＋</Link> : null}</div>
              <div className="space-y-1">
                {dayEntries.slice(0, limit).map((entry) => <Link key={`${entry.id}-${ds}`} to="/programmes" className={`block rounded-md border px-1.5 py-1 text-[9px] leading-tight transition-colors sm:text-[10px] ${STATUS_STYLE[entry.status] ?? "border-slate-200 bg-slate-100 text-slate-700"}`}>
                  <span className="block truncate font-black">{entry.startTime ? `${entry.startTime.slice(0,5)} · ` : ""}{entry.title}</span>
                  <span className="block truncate opacity-80">{STATUS_LABEL[entry.status] ?? entry.status}</span>
                </Link>)}
                {dayEntries.length > limit ? <p className="text-[9px] font-bold text-muted-foreground">+ {dayEntries.length - limit} autre(s)</p> : null}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  </AppShell>;
}
