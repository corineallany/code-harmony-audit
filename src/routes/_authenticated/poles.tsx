import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { membersQuery, polesQuery } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/poles")({
  head: () => ({
    meta: [
      { title: "Pôles — COM ICC Le Mans" },
      {
        name: "description",
        content: "Organisation en pôles du service Communication ICC Le Mans : groupes, référents et effectifs.",
      },
      { property: "og:title", content: "Pôles — COM ICC Le Mans" },
      { property: "og:description", content: "Groupes, référents et effectifs de chaque pôle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Poles,
});

function Poles() {
  const poles = useQuery(polesQuery);
  const members = useQuery(membersQuery);

  const byPole = useMemo(() => {
    const memberName = new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name]));
    const map = new Map<string, { name: string; referent: boolean }[]>();
    for (const link of members.data?.links ?? []) {
      map.set(link.pole_id, [
        ...(map.get(link.pole_id) ?? []),
        { name: memberName.get(link.member_id) ?? link.member_id, referent: link.is_referent },
      ]);
    }
    return map;
  }, [members.data]);

  const groups = useMemo(() => {
    const grouped = new Map<string, typeof poles.data>();
    for (const pole of poles.data ?? []) {
      const key = pole.pole_group ?? "Autres pôles";
      grouped.set(key, [...((grouped.get(key) ?? []) as NonNullable<typeof poles.data>), pole]);
    }
    return [...grouped.entries()];
  }, [poles.data]);

  if (poles.isLoading) {
    return (
      <AppShell title="Pôles">
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Pôles" subtitle="Organisation du service">
      {groups.length === 0 ? (
        <EmptyState title="Aucun pôle enregistré" />
      ) : (
        <div className="space-y-8">
          {groups.map(([group, list]) => (
            <section key={group}>
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {group}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(list ?? []).map((pole) => {
                  const people = byPole.get(pole.id) ?? [];
                  return (
                    <Card key={pole.id} className={pole.archived ? "opacity-60" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{pole.name}</CardTitle>
                          <Badge variant="secondary">{people.length}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {pole.description ? (
                          <p className="text-sm text-muted-foreground">{pole.description}</p>
                        ) : null}
                        {people.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aucun équipier affecté.</p>
                        ) : (
                          <ul className="space-y-1 text-sm">
                            {people.map((p) => (
                              <li key={p.name} className={p.referent ? "font-semibold" : ""}>
                                {p.name}
                                {p.referent ? " · référent" : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
