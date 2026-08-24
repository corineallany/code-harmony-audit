import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import {
  availabilityQuery,
  debriefsQuery,
  evaluationsQuery,
  formatDate,
  isProgramFinished,
  programsQuery,
  solicitationsQuery,
  tasksQuery,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/a-faire")({
  head: () => ({
    meta: [
      { title: "À faire — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Centre d'actions du pôle Communication ICC Le Mans : uniquement ce qui attend une action de votre part.",
      },
      { property: "og:title", content: "À faire — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Programmes à confirmer, sollicitations à répondre, validations et comptes rendus en attente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActionCenter,
});

type Action = { id: string; label: string; detail: string; to: string; params?: Record<string, string>; scope: string };

function ActionCenter() {
  const { member, isStaff, isAdmin, userId } = useCurrentRole();
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const availability = useQuery(availabilityQuery);
  const tasks = useQuery(tasksQuery);
  const debriefs = useQuery(debriefsQuery);
  const evaluations = useQuery(evaluationsQuery);

  const memberId = member?.id ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const actions: Action[] = [];

  // 1. Programmes à confirmer (personnel)
  for (const p of programs.data ?? []) {
    if (!memberId || p.archived || p.status === "cancelled") continue;
    if ((p.start_date ?? "9999") < today) continue;
    const assigned = p.assignments.some((a) => a.memberIds.includes(memberId));
    const answered = p.responses.some((r) => r.member_id === memberId && r.status !== "pending");
    if (assigned && !answered) {
      actions.push({
        id: `prog-${p.id}`,
        label: "Répondre à une affectation",
        detail: `${p.title} — ${formatDate(p.start_date)}`,
        to: "/programme/$id",
        params: { id: p.id },
        scope: "Personnel",
      });
    }
  }

  // 2. Sollicitations sans décision (encadrement)
  if (isStaff) {
    for (const s of solicitations.data ?? []) {
      if (s.archived || s.deleted) continue;
      if (!s.decision && s.status !== "accepted" && s.status !== "refused") {
        actions.push({
          id: `sol-${s.id}`,
          label: "Traiter une sollicitation ponctuelle",
          detail: `${s.event_name ?? "Sollicitation"} — ${s.requester ?? "demandeur inconnu"}`,
          to: "/sollicitations",
          scope: "COM",
        });
      }
    }

    // 3. Indisponibilités à valider
    for (const a of availability.data ?? []) {
      if (a.status !== "pending") continue;
      actions.push({
        id: `av-${a.id}`,
        label: "Valider une indisponibilité",
        detail: `${new Date(a.starts_at).toLocaleDateString("fr-FR")} → ${new Date(a.ends_at).toLocaleDateString("fr-FR")}`,
        to: "/disponibilites",
        scope: "Pôle",
      });
    }

    // 4. Post-service à compléter
    for (const p of programs.data ?? []) {
      if (p.archived || p.status === "cancelled") continue;
      if (!isProgramFinished(p)) continue;
      const done = (debriefs.data ?? []).some((d) => d.program_id === p.id && d.status === "done");
      if (!done) {
        actions.push({
          id: `ps-${p.id}`,
          label: "Compléter le post-service",
          detail: `${p.title} — ${formatDate(p.start_date)}`,
          to: "/post-service",
          scope: "Pôle",
        });
      }
    }
  }

  // 5. Évaluations à rédiger / valider
  for (const e of evaluations.data ?? []) {
    if (e.status === "draft" && e.evaluator_user_id === userId) {
      actions.push({
        id: `ev-${e.id}`,
        label: "Terminer une évaluation",
        detail: e.period_label ?? "Évaluation en brouillon",
        to: "/evaluations",
        scope: "Personnel",
      });
    }
    if (e.status === "submitted" && isAdmin) {
      actions.push({
        id: `evv-${e.id}`,
        label: "Valider une évaluation",
        detail: e.period_label ?? "Évaluation soumise",
        to: "/evaluations",
        scope: "COM",
      });
    }
  }

  // 6. Tâches assignées non terminées
  for (const t of tasks.data ?? []) {
    if (t.status === "done") continue;
    if (memberId && t.assignee_member_id === memberId) {
      actions.push({
        id: `task-${t.id}`,
        label: "Tâche à traiter",
        detail: `${t.title}${t.due_date ? ` — échéance ${formatDate(t.due_date)}` : ""}`,
        to: "/taches",
        scope: "Personnel",
      });
    }
  }

  const loading =
    programs.isLoading || solicitations.isLoading || availability.isLoading || tasks.isLoading;

  return (
    <AppShell
      title="À faire"
      subtitle="Uniquement ce qui attend réellement une action de votre part."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : actions.length === 0 ? (
        <EmptyState
          title="Rien à traiter"
          description="Tout est à jour : aucune action n'attend votre intervention."
        />
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{a.label}</CardTitle>
                  <Badge variant="outline">{a.scope}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{a.detail}</p>
                {a.params ? (
                  <Link
                    to="/programme/$id"
                    params={a.params as { id: string }}
                    className="text-xs font-bold text-icc-violet"
                  >
                    Ouvrir →
                  </Link>
                ) : (
                  <Link to={a.to} className="text-xs font-bold text-icc-violet">
                    Ouvrir →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
