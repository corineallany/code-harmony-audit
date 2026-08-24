import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { AppShell, EmptyState } from "@/components/AppShell";
import {
  formatDate,
  membersQuery,
  polesQuery,
  programsQuery,
  solicitationsQuery,
  tasksQuery,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/recherche")({
  head: () => ({
    meta: [
      { title: "Recherche universelle — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Recherche globale du pôle Communication : membres, programmes, sollicitations, pôles et tâches, dans le respect des droits.",
      },
      { property: "og:title", content: "Recherche universelle — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Retrouver instantanément un membre, un programme, une sollicitation, un pôle ou une tâche.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Recherche,
});

type Hit = { id: string; kind: string; title: string; detail: string; to: string };

const KIND_LABEL: Record<string, string> = {
  member: "Membre",
  program: "Programme",
  solicitation: "Sollicitation",
  pole: "Pôle",
  task: "Tâche",
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Recherche() {
  const [term, setTerm] = useState("");
  const members = useQuery(membersQuery);
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const poles = useQuery(polesQuery);
  const tasks = useQuery(tasksQuery);

  const hits = useMemo<Hit[]>(() => {
    const q = normalize(term.trim());
    if (q.length < 2) return [];
    const out: Hit[] = [];

    for (const m of members.data?.members ?? []) {
      out.push({
        id: `member-${m.id}`,
        kind: "member",
        title: m.full_name,
        detail: `${m.base_role} · ${m.status === "active" ? "Actif" : "Inactif"}`,
        to: "/trombinoscope",
      });
    }
    for (const p of programs.data ?? []) {
      out.push({
        id: `program-${p.id}`,
        kind: "program",
        title: p.title,
        detail: `${formatDate(p.start_date)}${p.location ? ` · ${p.location}` : ""}`,
        to: "/programmes",
      });
    }
    for (const s of solicitations.data ?? []) {
      out.push({
        id: `solicitation-${s.id}`,
        kind: "solicitation",
        title: s.event_name ?? "Sollicitation",
        detail: `${s.requester ?? "Demandeur inconnu"} · ${formatDate(s.event_date)}`,
        to: "/sollicitations",
      });
    }
    for (const p of poles.data ?? []) {
      out.push({
        id: `pole-${p.id}`,
        kind: "pole",
        title: p.name,
        detail: p.description ?? p.pole_group ?? "Pôle",
        to: "/poles",
      });
    }
    for (const t of tasks.data ?? []) {
      out.push({
        id: `task-${t.id}`,
        kind: "task",
        title: t.title,
        detail: t.detail ?? t.status,
        to: "/taches",
      });
    }

    return out.filter((hit) => normalize(`${hit.title} ${hit.detail}`).includes(q)).slice(0, 60);
  }, [term, members.data, programs.data, solicitations.data, poles.data, tasks.data]);

  return (
    <AppShell title="Recherche" subtitle="Membres, programmes, sollicitations, pôles et tâches">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Rechercher un nom, un programme, un pôle…"
          className="pl-9"
        />
      </div>

      <div className="mt-5 space-y-2">
        {term.trim().length < 2 ? (
          <EmptyState title="Saisis au moins deux caractères" />
        ) : hits.length === 0 ? (
          <EmptyState title="Aucun résultat" description={`Rien ne correspond à « ${term} ».`} />
        ) : (
          hits.map((hit) => (
            <Link key={hit.id} to={hit.to}>
              <Card className="transition-colors hover:border-icc-violet/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-bold">{hit.title}</p>
                    <p className="text-xs text-muted-foreground">{hit.detail}</p>
                  </div>
                  <Badge variant="secondary">{KIND_LABEL[hit.kind] ?? hit.kind}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
