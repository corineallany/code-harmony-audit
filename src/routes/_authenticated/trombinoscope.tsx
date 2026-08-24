import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { membersQuery, polesQuery } from "@/lib/icc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/trombinoscope")({
  head: () => ({
    meta: [
      { title: "Trombinoscope — COM ICC Le Mans" },
      {
        name: "description",
        content: "Annuaire des équipiers du pôle Communication ICC Le Mans avec leurs pôles et rôles de référent.",
      },
      { property: "og:title", content: "Trombinoscope — COM ICC Le Mans" },
      { property: "og:description", content: "Équipiers, pôles d'appartenance et référents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trombinoscope,
});

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Trombinoscope() {
  const members = useQuery(membersQuery);
  const poles = useQuery(polesQuery);
  const [search, setSearch] = useState("");

  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);

  const rows = useMemo(() => {
    const links = members.data?.links ?? [];
    return (members.data?.members ?? [])
      .filter((m) => m.full_name.toLowerCase().includes(search.trim().toLowerCase()))
      .map((m) => ({
        ...m,
        poles: links
          .filter((l) => l.member_id === m.id)
          .map((l) => ({ name: poleName.get(l.pole_id) ?? "Pôle", referent: l.is_referent })),
      }));
  }, [members.data, poleName, search]);

  return (
    <AppShell title="Trombinoscope" subtitle={`${rows.length} équipier(s)`}>
      <Input
        placeholder="Rechercher un équipier…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-5 max-w-sm"
      />

      {members.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun équipier trouvé" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <Card key={m.id} className={m.active ? "" : "opacity-60"}>
              <CardContent className="flex gap-3 p-4">
                <Avatar className="size-12">
                  {m.photo_url ? <AvatarImage src={m.photo_url} alt={m.full_name} /> : null}
                  <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.full_name}</p>
                  {m.phone || m.email ? (
                    <p className="truncate text-xs text-muted-foreground">{m.phone ?? m.email}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.poles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sans pôle</span>
                    ) : (
                      m.poles.map((p) => (
                        <Badge key={p.name} variant={p.referent ? "default" : "secondary"} className="text-[0.7rem]">
                          {p.name}
                          {p.referent ? " · référent" : ""}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
