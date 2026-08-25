import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  hiddenItemsQuery,
  logAction,
  membersQuery,
  polesQuery,
  programsQuery,
  RESPONSE_LABEL,
  solicitationsQuery,
  STATUS_LABEL,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/mes-services")({
  head: () => ({
    meta: [
      { title: "Mes services — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Vue personnelle regroupant vos programmes et vos sollicitations ponctuelles, avec archivage et masquage.",
      },
      { property: "og:title", content: "Mes services — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Programmes et sollicitations qui vous concernent, en une seule liste.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MesServices,
});

function MesServices() {
  const { member, userId, isStaff } = useCurrentRole();
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const poles = useQuery(polesQuery);
  const membersData = useQuery(membersQuery);
  const hidden = useQuery(hiddenItemsQuery(userId ?? undefined));
  const queryClient = useQueryClient();
  const [showHidden, setShowHidden] = useState(false);

  const memberId = member?.id ?? null;
  const myPoleIds = new Set(
    (membersData.data?.links ?? []).filter((l) => l.member_id === memberId).map((l) => l.pole_id),
  );
  const poleName = (id: string | null) =>
    poles.data?.find((p) => p.id === id)?.name ?? "Pôle";

  const isHidden = (entity: string, id: string) =>
    (hidden.data ?? []).some((h) => h.entity === entity && h.entity_id === id);

  const toggleHidden = useMutation({
    mutationFn: async (item: { entity: string; id: string }) => {
      if (!userId) throw new Error("Session introuvable");
      const row = (hidden.data ?? []).find(
        (h) => h.entity === item.entity && h.entity_id === item.id,
      );
      if (row) {
        const { error } = await supabase.from("user_hidden_items").delete().eq("id", row.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("user_hidden_items")
          .insert({ user_id: userId, entity: item.entity, entity_id: item.id });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-hidden-items"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archive = useMutation({
    mutationFn: async (item: { entity: "programs" | "solicitations"; id: string }) => {
      if (item.entity === "programs") {
        const { error } = await supabase.from("programs").update({ archived: true }).eq("id", item.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("solicitations")
          .update({ archived: true, archived_at: new Date().toISOString() })
          .eq("id", item.id);
        if (error) throw new Error(error.message);
      }
      await logAction({
        action: "archive",
        entity: item.entity,
        entityId: item.id,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Élément archivé");
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["solicitations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const myPrograms = memberId
    ? (programs.data ?? []).filter(
        (p) => !p.archived && p.assignments.some((a) => a.memberIds.includes(memberId)),
      )
    : [];

  const mySolicitations = memberId
    ? (solicitations.data ?? []).filter(
        (s) =>
          !s.archived &&
          (s.replacement_member_id === memberId ||
            (s.target_pole_id && myPoleIds.has(s.target_pole_id)) ||
            (s.target_name && s.target_name === member?.full_name)),
      )
    : [];

  type Row = {
    key: string;
    entity: "programs" | "solicitations";
    id: string;
    title: string;
    date: string | null;
    meta: string;
    status: string;
  };

  const rows: Row[] = [
    ...myPrograms.map((p) => {
      const response = p.responses.find((r) => r.member_id === memberId);
      const myPoles = p.assignments
        .filter((a) => memberId && a.memberIds.includes(memberId))
        .map((a) => poleName(a.pole_id));
      return {
        key: `programs:${p.id}`,
        entity: "programs" as const,
        id: p.id,
        title: p.title,
        date: p.start_date,
        meta: `${STATUS_LABEL[p.status] ?? p.status}${myPoles.length ? ` · ${myPoles.join(", ")}` : ""}`,
        status: response ? RESPONSE_LABEL[response.status] : "À confirmer",
      };
    }),
    ...mySolicitations.map((s) => ({
      key: `solicitations:${s.id}`,
      entity: "solicitations" as const,
      id: s.id,
      title: s.event_name ?? "Sollicitation ponctuelle",
      date: s.event_date,
      meta: s.requester ? `Demandé par ${s.requester}` : "Sollicitation ponctuelle",
      status: STATUS_LABEL[s.status] ?? s.status,
    })),
  ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  const visible = rows.filter((r) => showHidden || !isHidden(r.entity, r.id));
  const hiddenCount = rows.filter((r) => isHidden(r.entity, r.id)).length;
  const loading = programs.isLoading || solicitations.isLoading;

  return (
    <AppShell
      title="Mes services"
      subtitle="Vos programmes et sollicitations réunis dans une seule vue personnelle"
      actions={
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowHidden((v) => !v)}>
          {showHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {showHidden ? "Masquer les éléments retirés" : `Éléments retirés (${hiddenCount})`}
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Aucun service dans votre vue"
          description="Vos programmes et sollicitations apparaîtront ici dès qu'ils vous concerneront."
        />
      ) : (
        <div className="space-y-2">
          {visible.map((row) => (
            <div key={row.key} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.entity === "programs" ? "default" : "secondary"}>
                      {row.entity === "programs" ? "Programme" : "Sollicitation"}
                    </Badge>
                    {row.entity === "programs" ? (
                      <Link
                        to="/programme/$id"
                        params={{ id: row.id }}
                        className="font-bold text-icc-violet"
                      >
                        {row.title}
                      </Link>
                    ) : (
                      <p className="font-bold">{row.title}</p>
                    )}
                    {isHidden(row.entity, row.id) ? (
                      <Badge variant="outline">Retiré de ma vue</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(row.date)} · {row.meta}
                  </p>
                </div>
                <Badge variant="outline">{row.status}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => toggleHidden.mutate({ entity: row.entity, id: row.id })}
                >
                  <EyeOff className="size-4" />
                  {isHidden(row.entity, row.id) ? "Remettre dans ma vue" : "Retirer de ma vue"}
                </Button>
                {isStaff ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => archive.mutate({ entity: row.entity, id: row.id })}
                  >
                    <Archive className="size-4" /> Archiver
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
