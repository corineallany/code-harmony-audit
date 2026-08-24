import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { downloadCsv, exportStamp, toCsv, type Column } from "@/lib/exports";
import {
  auditQuery,
  formatDateTime,
  logAction,
  membersQuery,
  polesQuery,
  programsQuery,
  RESPONSE_LABEL,
  solicitationsQuery,
  STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  tasksQuery,
} from "@/lib/icc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/exports")({
  head: () => ({
    meta: [
      { title: "Exports — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Exports unifiés du pôle Communication : équipiers, pôles, programmes, sollicitations, tâches et journal d'activité au format CSV.",
      },
      { property: "og:title", content: "Exports — COM ICC Le Mans" },
      { property: "og:description", content: "Un seul écran pour tous les exports CSV du pôle Communication." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Exports,
});

function Exports() {
  const { member } = useCurrentRole();
  const poles = useQuery(polesQuery);
  const members = useQuery(membersQuery);
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const tasks = useQuery(tasksQuery);
  const audit = useQuery(auditQuery);

  const poleName = new Map((poles.data ?? []).map((p) => [p.id, p.name]));
  const memberName = new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name]));
  const links = members.data?.links ?? [];

  async function run<T>(name: string, label: string, rows: T[], columns: Column<T>[]) {
    if (rows.length === 0) {
      toast.info("Rien à exporter", { description: `Aucune donnée pour « ${label} ».` });
      return;
    }
    downloadCsv(`icc-${name}-${exportStamp()}.csv`, toCsv(rows, columns));
    toast.success(`${label} exporté`, { description: `${rows.length} ligne(s)` });
    await logAction({
      action: "export_csv",
      entity: name,
      detail: `${label} — ${rows.length} ligne(s)`,
      actorName: member?.full_name,
    });
  }

  const blocks: Array<{ name: string; label: string; description: string; count: number; go: () => void }> = [
    {
      name: "equipiers",
      label: "Équipiers",
      description: "Identité, statut, rôle de base, arrivée, pôles rattachés.",
      count: (members.data?.members ?? []).length,
      go: () =>
        run("equipiers", "Équipiers", members.data?.members ?? [], [
          { key: "full_name", label: "Nom complet", value: (m) => m.full_name },
          { key: "base_role", label: "Rôle de base", value: (m) => m.base_role },
          { key: "status", label: "Statut", value: (m) => m.status },
          { key: "login_email", label: "E-mail", value: (m) => m.login_email },
          { key: "arrivee", label: "Arrivée", value: (m) => [m.arrival_month, m.arrival_year].filter(Boolean).join("/") },
          { key: "ejp", label: "EJP", value: (m) => m.is_ejp },
          { key: "icc", label: "ICC", value: (m) => m.is_icc },
          { key: "formation", label: "Formation faite", value: (m) => m.training_done },
          {
            key: "poles",
            label: "Pôles",
            value: (m) =>
              links
                .filter((l) => l.member_id === m.id)
                .map((l) => `${poleName.get(l.pole_id) ?? l.pole_id}${l.is_referent ? " (référent)" : ""}`)
                .join(" · "),
          },
        ]),
    },
    {
      name: "poles",
      label: "Pôles",
      description: "Nom, groupe, description, ordre d’affichage, archivage.",
      count: (poles.data ?? []).length,
      go: () =>
        run("poles", "Pôles", poles.data ?? [], [
          { key: "name", label: "Nom", value: (p) => p.name },
          { key: "pole_group", label: "Groupe", value: (p) => p.pole_group },
          { key: "description", label: "Description", value: (p) => p.description },
          { key: "sort_order", label: "Ordre", value: (p) => p.sort_order },
          { key: "archived", label: "Archivé", value: (p) => p.archived },
          {
            key: "members",
            label: "Équipiers",
            value: (p) =>
              links
                .filter((l) => l.pole_id === p.id)
                .map((l) => memberName.get(l.member_id) ?? l.member_id)
                .join(" · "),
          },
        ]),
    },
    {
      name: "programmes",
      label: "Programmes",
      description: "Dates, lieu, statut, pôles affectés, équipiers et réponses.",
      count: (programs.data ?? []).length,
      go: () =>
        run("programmes", "Programmes", programs.data ?? [], [
          { key: "title", label: "Titre", value: (p) => p.title },
          { key: "start_date", label: "Date début", value: (p) => p.start_date },
          { key: "start_time", label: "Heure début", value: (p) => p.start_time },
          { key: "end_date", label: "Date fin", value: (p) => p.end_date },
          { key: "end_time", label: "Heure fin", value: (p) => p.end_time },
          { key: "location", label: "Lieu", value: (p) => p.location },
          { key: "status", label: "Statut", value: (p) => STATUS_LABEL[p.status] ?? p.status },
          { key: "importance", label: "Importance", value: (p) => p.importance },
          {
            key: "poles",
            label: "Pôles affectés",
            value: (p) => p.assignments.map((a) => poleName.get(a.pole_id) ?? a.pole_id).join(" · "),
          },
          {
            key: "membres",
            label: "Équipiers affectés",
            value: (p) =>
              [...new Set(p.assignments.flatMap((a) => a.memberIds))]
                .map((id) => memberName.get(id) ?? id)
                .join(" · "),
          },
          {
            key: "reponses",
            label: "Réponses",
            value: (p) =>
              p.responses
                .map((r) => `${memberName.get(r.member_id) ?? r.member_id}: ${RESPONSE_LABEL[r.status]}`)
                .join(" · "),
          },
        ]),
    },
    {
      name: "sollicitations",
      label: "Sollicitations",
      description: "Demandeur, événement, cible, statut et décision.",
      count: (solicitations.data ?? []).length,
      go: () =>
        run("sollicitations", "Sollicitations", solicitations.data ?? [], [
          { key: "event_name", label: "Événement", value: (s) => s.event_name },
          { key: "event_date", label: "Date", value: (s) => s.event_date },
          { key: "requester", label: "Demandeur", value: (s) => s.requester },
          { key: "mode", label: "Mode", value: (s) => s.mode },
          { key: "status", label: "Statut", value: (s) => STATUS_LABEL[s.status] ?? s.status },
          { key: "target", label: "Cible", value: (s) => s.target_name ?? poleName.get(s.target_pole_id ?? "") },
          { key: "decision", label: "Décision", value: (s) => s.decision },
          { key: "decision_note", label: "Note de décision", value: (s) => s.decision_note },
          { key: "message", label: "Message", value: (s) => s.message },
        ]),
    },
    {
      name: "taches",
      label: "Tâches",
      description: "To-do central : échéances, priorités, assignations.",
      count: (tasks.data ?? []).length,
      go: () =>
        run("taches", "Tâches", tasks.data ?? [], [
          { key: "title", label: "Tâche", value: (t) => t.title },
          { key: "status", label: "Statut", value: (t) => TASK_STATUS_LABEL[t.status] ?? t.status },
          { key: "priority", label: "Priorité", value: (t) => TASK_PRIORITY_LABEL[t.priority] ?? t.priority },
          { key: "due_date", label: "Échéance", value: (t) => t.due_date },
          {
            key: "assignee",
            label: "Assignée à",
            value: (t) => (t.assignee_member_id ? memberName.get(t.assignee_member_id) ?? t.assignee_member_id : ""),
          },
          { key: "pole", label: "Pôle", value: (t) => (t.pole_id ? poleName.get(t.pole_id) ?? t.pole_id : "") },
          { key: "detail", label: "Détail", value: (t) => t.detail },
        ]),
    },
    {
      name: "journal",
      label: "Journal d’activité",
      description: "100 dernières actions tracées dans le pilotage.",
      count: (audit.data ?? []).length,
      go: () =>
        run("journal", "Journal d’activité", audit.data ?? [], [
          { key: "occurred_at", label: "Date", value: (a) => formatDateTime(a.occurred_at) },
          { key: "action", label: "Action", value: (a) => a.action },
          { key: "actor_name", label: "Auteur", value: (a) => a.actor_name },
          { key: "entity", label: "Entité", value: (a) => a.entity },
          { key: "detail", label: "Détail", value: (a) => a.detail },
        ]),
    },
  ];

  return (
    <AppShell title="Exports" subtitle="Point d’entrée unique — CSV compatible Excel (UTF-8)">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((block) => (
          <Card key={block.name}>
            <CardHeader>
              <CardTitle className="text-base">{block.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{block.description}</p>
              <p className="text-xs text-muted-foreground">{block.count} ligne(s) disponibles</p>
              <Button className="w-full gap-2" onClick={block.go} disabled={block.count === 0}>
                <Download className="size-4" /> Exporter en CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
