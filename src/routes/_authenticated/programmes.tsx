import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { formatDate, membersQuery, polesQuery, programsQuery, STATUS_LABEL } from "@/lib/icc";
import {
  canonicalProgramFormat,
  canonicalProgramImportance,
  canonicalProgramRecurrence,
  canonicalProgramType,
  PROGRAM_FORMAT_OPTIONS,
  PROGRAM_IMPORTANCE_OPTIONS,
  PROGRAM_RECURRENCE_OPTIONS,
  PROGRAM_TYPE_OPTIONS,
  programFormatLabel,
  programImportanceLabel,
  programRecurrenceLabel,
  programTypeLabel,
} from "@/lib/programLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/programmes")({ component: Programmes });

const statusClass: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800 border-green-200",
  unconfirmed: "bg-amber-100 text-amber-800 border-amber-200",
  postponed: "bg-blue-100 text-blue-800 border-blue-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function Programmes() {
  const programs = useQuery(programsQuery);
  const poles = useQuery(polesQuery);
  const members = useQuery(membersQuery);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [format, setFormat] = useState("all");
  const [recurrence, setRecurrence] = useState("all");
  const [importance, setImportance] = useState("all");

  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);
  const memberName = useMemo(() => new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name])), [members.data]);
  const filtered = (programs.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    return (!q || [p.title, p.location, p.description].some((v) => v?.toLowerCase().includes(q))) &&
      (status === "all" || p.status === status) &&
      (type === "all" || canonicalProgramType(p.program_type) === type) &&
      (format === "all" || canonicalProgramFormat(p.format) === format) &&
      (recurrence === "all" || canonicalProgramRecurrence(p.recurrence) === recurrence) &&
      (importance === "all" || canonicalProgramImportance(p.importance) === importance);
  });

  if (programs.isLoading) return <AppShell title="Programmes"><Skeleton className="h-40 rounded-xl" /></AppShell>;

  return (
    <AppShell
      title="Programmes"
      subtitle="Programmes, équipes mobilisées et informations de service"
      actions={<Button asChild size="sm"><Link to="/administration" search={{ newProgram: "1" } as any}>+ Nouveau programme</Link></Button>}
    >
      <div className="mb-5 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Filter value={status} onChange={setStatus} placeholder="Statut" items={[["all","Tous les statuts"],["confirmed","Confirmé"],["unconfirmed","Non confirmé"],["postponed","Reporté"],["cancelled","Annulé"]]} />
        <Filter value={type} onChange={setType} placeholder="Type" items={[["all","Tous les types"], ...PROGRAM_TYPE_OPTIONS.map(([v,l]) => [v,l])]} />
        <Filter value={format} onChange={setFormat} placeholder="Format" items={[["all","Tous les formats"], ...PROGRAM_FORMAT_OPTIONS.map(([v,l]) => [v,l])]} />
        <Filter value={recurrence} onChange={setRecurrence} placeholder="Récurrence" items={[["all","Toutes récurrences"], ...PROGRAM_RECURRENCE_OPTIONS.map(([v,l]) => [v,l])]} />
        <Filter value={importance} onChange={setImportance} placeholder="Importance" items={[["all","Toutes importances"], ...PROGRAM_IMPORTANCE_OPTIONS.map(([v,l]) => [v,l])]} />
      </div>

      {filtered.length === 0 ? <EmptyState title="Aucun programme" /> : (
        <div className="space-y-4">
          {filtered.map((program) => (
            <article key={program.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold">
                    <Badge className={statusClass[program.status] ?? ""}>{STATUS_LABEL[program.status] ?? program.status}</Badge>
                    {program.program_type ? <Badge variant="outline">{programTypeLabel(program.program_type)}</Badge> : null}
                    {program.format ? <Badge variant="outline">{programFormatLabel(program.format)}</Badge> : null}
                    {program.importance ? <Badge variant="secondary">{programImportanceLabel(program.importance)}</Badge> : null}
                    <Badge variant="outline">{programRecurrenceLabel(program.recurrence)}</Badge>
                  </div>
                  <Link to="/programme/$id" params={{ id: program.id }} className="text-lg font-black text-icc-violet hover:underline">{program.title}</Link>
                  <p className="mt-1 text-sm font-semibold">📅 {formatDate(program.start_date)}{program.start_time ? ` · ${program.start_time.slice(0,5)}` : ""}</p>
                  {program.location ? <p className="mt-1 text-sm text-muted-foreground">{program.location}</p> : null}
                </div>
                <div className="max-w-sm text-right text-sm"><b>Pôles</b><p className="text-muted-foreground">{program.assignments.length ? program.assignments.map((a) => poleName.get(a.pole_id) ?? "Pôle").join(" · ") : "—"}</p></div>
              </div>
              {program.assignments.map((a) => <div key={a.id} className="mt-3 rounded-xl border-l-4 border-icc-violet bg-muted/40 p-3"><div className="flex items-center justify-between gap-2"><b className="text-icc-violet">{poleName.get(a.pole_id) ?? "Pôle"}</b><small className="text-muted-foreground">{a.memberIds.length} affecté(s)</small></div>{a.memberIds.length ? <div className="mt-2 space-y-1">{a.memberIds.map((mid) => <div key={mid} className="rounded-lg bg-background px-3 py-2 text-sm font-semibold">{memberName.get(mid) ?? mid}</div>)}</div> : null}<p className="mt-2 text-sm"><b>Tâches :</b> {a.tasks || "—"}</p></div>)}
              {program.general_note ? <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm"><b className="text-icc-violet">Note générale</b><p>{program.general_note}</p></div> : null}
              {program.description ? <p className="mt-3 text-sm text-muted-foreground">{program.description}</p> : null}
              <div className="mt-3"><Button asChild size="sm" variant="link" className="px-0 text-icc-violet"><Link to="/programme/$id" params={{ id: program.id }}>Ouvrir la fiche complète</Link></Button></div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
function Filter({ value, onChange, placeholder, items }: { value: string; onChange: (v:string)=>void; placeholder:string; items:readonly (readonly [string,string])[] | string[][] }) { return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder={placeholder}/></SelectTrigger><SelectContent>{items.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>; }
