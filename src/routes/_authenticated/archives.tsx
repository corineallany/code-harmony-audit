import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateTime, logAction } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/archives")({
  head: () => ({ meta: [{ title: "Archives & corbeille — COM ICC Le Mans" }] }),
  component: Archives,
});

type TableName = "programs" | "solicitations" | "poles" | "program_models" | "members";
type Entry = {
  key: string;
  id: string;
  table: TableName;
  label: string;
  detail: string;
  state: "archived" | "deleted";
};
type AuditRow = { entity: string | null; entity_id: string | null; action: string; actor_name: string | null; occurred_at: string };

const TABLE_LABEL: Record<TableName, string> = {
  programs: "Programme",
  solicitations: "Sollicitation",
  poles: "Pôle",
  program_models: "Modèle",
  members: "Membre",
};

const FILTERS: Array<{ value: "all" | TableName; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "programs", label: "Programmes" },
  { value: "solicitations", label: "Sollicitations" },
  { value: "members", label: "Membres" },
  { value: "poles", label: "Pôles" },
  { value: "program_models", label: "Modèles" },
];

const db = () => supabase as any;

function Archives() {
  const qc = useQueryClient();
  const { member, role, isTechAdmin } = useCurrentRole();
  const canManage = role === "responsable" || role === "adjoint" || isTechAdmin;
  const [view, setView] = useState<"archived" | "deleted">("archived");
  const [term, setTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TableName>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const programs = useQuery({
    queryKey: ["archives-programs"],
    queryFn: async () => {
      const { data, error } = await db().from("programs").select("*").or("archived.eq.true,deleted.eq.true").order("start_date", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const solicitations = useQuery({
    queryKey: ["archives-solicitations"],
    queryFn: async () => {
      const { data, error } = await db().from("solicitations").select("*").or("archived.eq.true,deleted.eq.true").order("event_date", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const members = useQuery({
    queryKey: ["archives-members"],
    queryFn: async () => {
      const { data, error } = await db().from("members").select("id,full_name,status,arrival_month,arrival_year,deleted").eq("status", "archived").order("full_name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const poles = useQuery({
    queryKey: ["archives-poles"],
    queryFn: async () => {
      const { data, error } = await db().from("poles").select("id,name,pole_group,archived,deleted").eq("archived", true).order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const models = useQuery({
    queryKey: ["archives-models"],
    queryFn: async () => {
      const { data, error } = await db().from("program_models").select("id,name,program_type,archived,deleted").eq("archived", true).order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const audit = useQuery({
    queryKey: ["archives-audit"],
    queryFn: async () => {
      const { data, error } = await db().from("audit_log").select("entity,entity_id,action,actor_name,occurred_at").in("action", ["element_archive", "element_archivee", "element_corbeille", "element_restaure", "element_supprime_definitivement"]).order("occurred_at", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditRow[];
    },
  });

  const entries = useMemo<Entry[]>(() => [
    ...(programs.data ?? []).map((p: any) => ({ key: `programs-${p.id}`, id: p.id, table: "programs" as const, label: p.title, detail: formatDate(p.start_date), state: p.deleted ? "deleted" as const : "archived" as const })),
    ...(solicitations.data ?? []).map((s: any) => ({ key: `solicitations-${s.id}`, id: s.id, table: "solicitations" as const, label: s.event_name ?? "Sollicitation", detail: `${s.requester ?? "Demandeur inconnu"} · ${formatDate(s.event_date)}`, state: s.deleted ? "deleted" as const : "archived" as const })),
    ...(members.data ?? []).map((m: any) => ({ key: `members-${m.id}`, id: m.id, table: "members" as const, label: m.full_name, detail: m.arrival_year ? `Intégration ${m.arrival_month ? `${m.arrival_month}/` : ""}${m.arrival_year}` : "Membre archivé", state: m.deleted ? "deleted" as const : "archived" as const })),
    ...(poles.data ?? []).map((p: any) => ({ key: `poles-${p.id}`, id: p.id, table: "poles" as const, label: p.name, detail: p.pole_group ?? "Pôle archivé", state: p.deleted ? "deleted" as const : "archived" as const })),
    ...(models.data ?? []).map((m: any) => ({ key: `program_models-${m.id}`, id: m.id, table: "program_models" as const, label: m.name, detail: m.program_type ?? "Modèle archivé", state: m.deleted ? "deleted" as const : "archived" as const })),
  ], [programs.data, solicitations.data, members.data, poles.data, models.data]);

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.state !== view) return false;
      if (typeFilter !== "all" && entry.table !== typeFilter) return false;
      if (q && !`${entry.label} ${entry.detail} ${TABLE_LABEL[entry.table]}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, view, typeFilter, term]);

  const selectedEntries = visible.filter((entry) => selected.has(entry.key));
  const allSelected = visible.length > 0 && visible.every((entry) => selected.has(entry.key));

  function refresh() {
    for (const key of ["programs", "solicitations", "members", "poles", "program-models", "archives-programs", "archives-solicitations", "archives-members", "archives-poles", "archives-models", "archives-audit", "audit-log"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    setSelected(new Set());
  }

  function lastMovement(entry: Entry) {
    const rows = audit.data ?? [];
    const aliases = new Set([entry.table, entry.table.replace(/s$/, ""), entry.table === "program_models" ? "program_model" : entry.table]);
    const expected = entry.state === "deleted" ? "element_corbeille" : null;
    return rows.find((row) => row.entity_id === entry.id && aliases.has(row.entity ?? "") && (!expected || row.action === expected))
      ?? rows.find((row) => row.entity_id === entry.id && aliases.has(row.entity ?? ""));
  }

  async function updateEntry(entry: Entry, destination: "active" | "archived" | "deleted") {
    let error: any = null;
    if (entry.table === "members") {
      const payload = destination === "active" ? { status: "active", deleted: false } : { status: "archived", deleted: destination === "deleted" };
      ({ error } = await db().from("members").update(payload).eq("id", entry.id));
    } else {
      const payload = destination === "active"
        ? { archived: false, deleted: false }
        : { archived: true, deleted: destination === "deleted" };
      ({ error } = await db().from(entry.table).update(payload).eq("id", entry.id));
    }
    if (error) throw new Error(error.message);
  }

  const move = useMutation({
    mutationFn: async ({ items, destination }: { items: Entry[]; destination: "active" | "archived" | "deleted" }) => {
      if (!canManage) throw new Error("Action réservée à la Direction et à l’Administrateur technique.");
      for (const entry of items) {
        await updateEntry(entry, destination);
        const action = destination === "deleted" ? "element_corbeille" : "element_restaure";
        const detail = destination === "active" ? `${entry.label} · restauré dans l’application` : destination === "archived" ? `${entry.label} · restauré dans les archives` : entry.label;
        await logAction({ action, entity: entry.table, entityId: entry.id, detail, actorName: member?.full_name });
      }
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.destination === "deleted" ? "Élément(s) placé(s) dans la corbeille" : vars.destination === "active" ? "Élément(s) restauré(s)" : "Élément(s) replacé(s) dans les archives");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const purge = useMutation({
    mutationFn: async (items: Entry[]) => {
      if (!canManage) throw new Error("Action réservée à la Direction et à l’Administrateur technique.");
      for (const entry of items) {
        if (entry.state !== "deleted") throw new Error("Un élément doit d’abord passer par la corbeille.");
        const { error } = await db().from(entry.table).delete().eq("id", entry.id);
        if (error) throw new Error(error.message);
        await logAction({ action: "element_supprime_definitivement", entity: entry.table, entityId: entry.id, detail: entry.label, actorName: member?.full_name });
      }
    },
    onSuccess: () => {
      toast.success("Suppression définitive effectuée");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loading = programs.isLoading || solicitations.isLoading || members.isLoading || poles.isLoading || models.isLoading;

  return (
    <AppShell title="Archives & corbeille" subtitle="Conserver, restaurer ou supprimer définitivement avec un double niveau de sécurité">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant={view === "archived" ? "default" : "outline"} onClick={() => { setView("archived"); setSelected(new Set()); }}>
          Archives <Badge variant="secondary" className="ml-2">{entries.filter((e) => e.state === "archived").length}</Badge>
        </Button>
        <Button variant={view === "deleted" ? "destructive" : "outline"} onClick={() => { setView("deleted"); setSelected(new Set()); }}>
          Corbeille <Badge variant="secondary" className="ml-2">{entries.filter((e) => e.state === "deleted").length}</Badge>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Rechercher dans les archives…" className="pl-9" />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          {FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
        </select>
      </div>

      {canManage && visible.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center gap-2 pr-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={(checked) => setSelected(checked ? new Set(visible.map((e) => e.key)) : new Set())} />
            <span>{allSelected ? "Tout désélectionner" : "Tout sélectionner"}</span>
          </div>
          {selectedEntries.length ? <Badge variant="secondary">{selectedEntries.length} sélectionné(s)</Badge> : null}
          {selectedEntries.length && view === "archived" ? (
            <>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => move.mutate({ items: selectedEntries, destination: "active" })}><ArchiveRestore className="size-4" /> Restaurer la sélection</Button>
              <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => { if (window.confirm(`Placer ${selectedEntries.length} élément(s) dans la corbeille ?`)) move.mutate({ items: selectedEntries, destination: "deleted" }); }}><Trash2 className="size-4" /> Mettre à la corbeille</Button>
            </>
          ) : null}
          {selectedEntries.length && view === "deleted" ? (
            <>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => move.mutate({ items: selectedEntries, destination: "archived" })}><RotateCcw className="size-4" /> Restaurer dans Archives</Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => { if (window.confirm(`Supprimer définitivement ${selectedEntries.length} élément(s) ? Cette action est irréversible.`)) purge.mutate(selectedEntries); }}><Trash2 className="size-4" /> Supprimer définitivement</Button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />) : visible.length === 0 ? (
          <EmptyState title={view === "archived" ? "Aucune archive" : "Corbeille vide"} description={term || typeFilter !== "all" ? "Aucun élément ne correspond à ces filtres." : view === "archived" ? "Les éléments archivés apparaîtront ici." : "Les éléments envoyés à la corbeille apparaîtront ici."} />
        ) : visible.map((entry) => {
          const movement = lastMovement(entry);
          return (
            <Card key={entry.key}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {canManage ? <Checkbox checked={selected.has(entry.key)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(entry.key); else next.delete(entry.key); return next; })} /> : null}
                  <div className="min-w-0">
                    <p className="font-bold">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{entry.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {movement ? `${entry.state === "deleted" ? "Mis à la corbeille" : "Dernière action"} ${formatDateTime(movement.occurred_at)}${movement.actor_name ? ` par ${movement.actor_name}` : ""}` : "Auteur/date non disponibles pour cet ancien élément"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{TABLE_LABEL[entry.table]}</Badge>
                  <Badge variant={entry.state === "deleted" ? "destructive" : "outline"}>{entry.state === "deleted" ? "Corbeille" : "Archivé"}</Badge>
                  {canManage && entry.state === "archived" ? (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => move.mutate({ items: [entry], destination: "active" })}><ArchiveRestore className="size-4" /> Restaurer</Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => { if (window.confirm(`Placer « ${entry.label} » dans la corbeille ?`)) move.mutate({ items: [entry], destination: "deleted" }); }}><Trash2 className="size-4" /> Corbeille</Button>
                    </>
                  ) : null}
                  {canManage && entry.state === "deleted" ? (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => move.mutate({ items: [entry], destination: "archived" })}><RotateCcw className="size-4" /> Restaurer dans Archives</Button>
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => { if (window.confirm(`Supprimer définitivement « ${entry.label} » ? Cette action est irréversible.`)) purge.mutate([entry]); }}><Trash2 className="size-4" /> Supprimer définitivement</Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
