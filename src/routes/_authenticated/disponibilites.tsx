import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Field, newId } from "@/components/admin/form-kit";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AVAILABILITY_STATUS_LABEL,
  availabilityQuery,
  formatDateTime,
  logAction,
  membersQuery,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/disponibilites")({
  head: () => ({
    meta: [
      { title: "Indisponibilités — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Déclaration et validation des indisponibilités des équipiers : périodes d'absence connues automatiquement du planning et des programmes.",
      },
      { property: "og:title", content: "Indisponibilités — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Déclarer une absence, suivre les validations et éviter les affectations impossibles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Disponibilites,
});

type Draft = { starts_at: string; ends_at: string; note: string; member_id: string };

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  validated: "bg-emerald-100 text-emerald-900",
  refused: "bg-rose-100 text-rose-900",
};

function toLocalInput(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

function Disponibilites() {
  const availability = useQuery(availabilityQuery);
  const members = useQuery(membersQuery);
  const queryClient = useQueryClient();
  const { member, isStaff, isAdmin, userId } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const memberName = new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name]));
  const rows = availability.data ?? [];
  const mine = rows.filter((r) => r.member_id === member?.id);
  const others = rows.filter((r) => r.member_id !== member?.id);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["member-availability"] });
  }

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const memberId = value.member_id || member?.id;
      if (!memberId) throw new Error("Aucun membre associé à ce compte.");
      if (!value.starts_at || !value.ends_at) throw new Error("Les deux dates sont obligatoires.");
      if (new Date(value.ends_at) < new Date(value.starts_at))
        throw new Error("La date de fin doit suivre la date de début.");
      const { error } = await supabase.from("member_availability").insert({
        id: newId("ind"),
        member_id: memberId,
        starts_at: new Date(value.starts_at).toISOString(),
        ends_at: new Date(value.ends_at).toISOString(),
        note: value.note.trim() || null,
        // Une déclaration d'équipier attend une validation ; l'encadrement valide directement.
        status: isStaff ? "validated" : "pending",
      });
      if (error) throw new Error(error.message);
      await logAction({
        action: "indisponibilite_declaree",
        entity: "member_availability",
        entityId: memberId,
        detail: `${value.starts_at} → ${value.ends_at}`,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Indisponibilité enregistrée");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "validated" | "refused" }) => {
      const { error } = await supabase
        .from("member_availability")
        .update({ status, decided_by: userId ?? null, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await logAction({
        action: status === "validated" ? "indisponibilite_validee" : "indisponibilite_refusee",
        entity: "member_availability",
        entityId: id,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      refresh();
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_availability").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await logAction({
        action: "indisponibilite_supprimee",
        entity: "member_availability",
        entityId: id,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Indisponibilité supprimée");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function Row({ id, memberId, start, end, note, status }: {
    id: string;
    memberId: string;
    start: string;
    end: string;
    note: string | null;
    status: string;
  }) {
    const canDecide = isStaff && status === "pending";
    const canDelete = isAdmin || memberId === member?.id;
    return (
      <div className="rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-bold">{memberName.get(memberId) ?? memberId}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(start)} → {formatDateTime(end)}
            </p>
            {note ? <p className="mt-1 text-sm">{note}</p> : null}
          </div>
          <Badge className={STATUS_TONE[status] ?? ""} variant="secondary">
            {AVAILABILITY_STATUS_LABEL[status] ?? status}
          </Badge>
        </div>
        {canDecide || canDelete ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {canDecide ? (
              <>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id, status: "validated" })}
                >
                  <Check className="size-4" /> Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id, status: "refused" })}
                >
                  <X className="size-4" /> Refuser
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(id)}
              >
                <Trash2 className="size-4" /> Supprimer
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <AppShell
      title="Indisponibilités"
      subtitle="Une absence déclarée est connue du planning, des programmes et des sollicitations"
      actions={
        <Button
          size="sm"
          className="gap-1"
          onClick={() => setDraft({ starts_at: "", ends_at: "", note: "", member_id: member?.id ?? "" })}
        >
          <Plus className="size-4" /> Déclarer une absence
        </Button>
      }
    >
      {availability.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mes indisponibilités</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mine.length === 0 ? (
                <EmptyState title="Aucune absence déclarée" />
              ) : (
                mine.map((r) => (
                  <Row
                    key={r.id}
                    id={r.id}
                    memberId={r.member_id}
                    start={r.starts_at}
                    end={r.ends_at}
                    note={r.note}
                    status={r.status ?? "validated"}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Équipe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {others.length === 0 ? (
                <EmptyState title="Aucune autre indisponibilité" />
              ) : (
                others.map((r) => (
                  <Row
                    key={r.id}
                    id={r.id}
                    memberId={r.member_id}
                    start={r.starts_at}
                    end={r.ends_at}
                    note={r.note}
                    status={r.status ?? "validated"}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Déclarer une indisponibilité</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              {isStaff ? (
                <Field label="Membre concerné">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={draft.member_id}
                    onChange={(e) => setDraft({ ...draft, member_id: e.target.value })}
                  >
                    <option value="">Moi-même</option>
                    {(members.data?.members ?? [])
                      .filter((m) => m.status === "active")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                  </select>
                </Field>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Début">
                  <Input
                    type="datetime-local"
                    value={draft.starts_at}
                    onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
                  />
                </Field>
                <Field label="Fin">
                  <Input
                    type="datetime-local"
                    value={draft.ends_at}
                    onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Motif (optionnel)">
                <Textarea
                  rows={2}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Synchronisation…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export { toLocalInput };
