import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/AppShell";
import { Field, newId } from "@/components/admin/form-kit";
import { ROLE_LABEL, useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAction, membersQuery, polesQuery, type Member } from "@/lib/icc";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type AppRole = Database["public"]["Enums"]["app_role"];
type MemberStatus = Database["public"]["Enums"]["member_status"];

const ROLES: AppRole[] = ["responsable", "adjoint", "referent", "equipier"];
const STATUSES: { value: MemberStatus; label: string }[] = [
  { value: "active", label: "Actif" },
  { value: "inactive", label: "Inactif" },
  { value: "archived", label: "Archivé" },
];

type Draft = {
  id: string | null;
  first_name: string;
  last_name: string;
  base_role: AppRole;
  status: MemberStatus;
  login_email: string;
  affiliations: string;
  is_ejp: boolean;
  is_icc: boolean;
  training_done: boolean;
  poles: Record<string, { selected: boolean; referent: boolean }>;
};

function emptyDraft(): Draft {
  return {
    id: null,
    first_name: "",
    last_name: "",
    base_role: "equipier",
    status: "active",
    login_email: "",
    affiliations: "",
    is_ejp: false,
    is_icc: false,
    training_done: false,
    poles: {},
  };
}

export function AdminMembres() {
  const members = useQuery(membersQuery);
  const poles = useQuery(polesQuery);
  const queryClient = useQueryClient();
  const { member: actor } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");

  const activePoles = useMemo(() => (poles.data ?? []).filter((p) => !p.archived), [poles.data]);
  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);

  const rows = useMemo(() => {
    const links = members.data?.links ?? [];
    const needle = search.trim().toLowerCase();
    return (members.data?.members ?? [])
      .filter((m) => m.full_name.toLowerCase().includes(needle))
      .map((m) => ({
        ...m,
        poles: links.filter((l) => l.member_id === m.id),
      }));
  }, [members.data, search]);

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const first = value.first_name.trim();
      const last = value.last_name.trim();
      const fullName = `${first} ${last}`.trim();
      if (!fullName) throw new Error("Le prénom ou le nom est obligatoire.");

      const id = value.id ?? newId("m");
      const payload = {
        first_name: first || null,
        last_name: last || null,
        full_name: fullName,
        base_role: value.base_role,
        status: value.status,
        login_email: value.login_email.trim() || null,
        affiliations: value.affiliations.trim() || null,
        is_ejp: value.is_ejp,
        is_icc: value.is_icc,
        training_done: value.training_done,
      };

      if (value.id) {
        const { error } = await supabase.from("members").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("members").insert({ id, ...payload });
        if (error) throw new Error(error.message);
      }

      // Affectations aux pôles : on remplace l'ensemble, une seule voie d'écriture.
      const { error: delError } = await supabase.from("member_poles").delete().eq("member_id", id);
      if (delError) throw new Error(delError.message);
      const rowsToInsert = Object.entries(value.poles)
        .filter(([, v]) => v.selected)
        .map(([poleId, v]) => ({ member_id: id, pole_id: poleId, is_referent: v.referent }));
      if (rowsToInsert.length > 0) {
        const { error: insError } = await supabase.from("member_poles").insert(rowsToInsert);
        if (insError) throw new Error(insError.message);
      }

      await logAction({
        action: value.id ? "equipier_modifie" : "equipier_cree",
        entity: "member",
        entityId: id,
        detail: fullName,
        actorName: actor?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Équipier enregistré");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (error: Error) => toast.error("Enregistrement impossible", { description: error.message }),
  });

  function edit(row: Member & { poles: { pole_id: string; is_referent: boolean }[] }) {
    const map: Draft["poles"] = {};
    for (const link of row.poles) map[link.pole_id] = { selected: true, referent: link.is_referent };
    setDraft({
      id: row.id,
      first_name: row.first_name ?? "",
      last_name: row.last_name ?? "",
      base_role: row.base_role,
      status: row.status,
      login_email: row.login_email ?? "",
      affiliations: row.affiliations ?? "",
      is_ejp: row.is_ejp,
      is_icc: row.is_icc,
      training_done: row.training_done,
      poles: map,
    });
  }

  if (members.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Rechercher un équipier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" onClick={() => setDraft(emptyDraft())}>
          Nouvel équipier
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Aucun équipier trouvé" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className={row.status === "active" ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{row.full_name}</CardTitle>
                  <Badge variant="secondary">{ROLE_LABEL[row.base_role]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {STATUSES.find((s) => s.value === row.status)?.label}
                  {row.login_email ? ` · ${row.login_email}` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {row.poles.length === 0
                    ? "Aucun pôle"
                    : row.poles
                        .map((l) => `${poleName.get(l.pole_id) ?? "Pôle"}${l.is_referent ? " (réf.)" : ""}`)
                        .join(", ")}
                </p>
                <Button size="sm" variant="outline" onClick={() => edit(row)}>
                  Modifier
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier l'équipier" : "Nouvel équipier"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prénom" htmlFor="m-first">
                  <Input
                    id="m-first"
                    value={draft.first_name}
                    onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
                  />
                </Field>
                <Field label="Nom" htmlFor="m-last">
                  <Input
                    id="m-last"
                    value={draft.last_name}
                    onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Rôle de base">
                  <Select
                    value={draft.base_role}
                    onValueChange={(v) => setDraft({ ...draft, base_role: v as AppRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Statut">
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v as MemberStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="E-mail de connexion" htmlFor="m-mail">
                <Input
                  id="m-mail"
                  type="email"
                  value={draft.login_email}
                  onChange={(e) => setDraft({ ...draft, login_email: e.target.value })}
                />
              </Field>

              <Field label="Affiliations / notes" htmlFor="m-aff">
                <Textarea
                  id="m-aff"
                  rows={2}
                  value={draft.affiliations}
                  onChange={(e) => setDraft({ ...draft, affiliations: e.target.value })}
                />
              </Field>

              <div className="space-y-3 rounded-lg border border-border p-3">
                {(
                  [
                    ["is_icc", "Membre ICC"],
                    ["is_ejp", "EJP"],
                    ["training_done", "Formation terminée"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={draft[key]}
                      onCheckedChange={(checked) => setDraft({ ...draft, [key]: checked })}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pôles</p>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {activePoles.map((pole) => {
                    const state = draft.poles[pole.id] ?? { selected: false, referent: false };
                    return (
                      <div key={pole.id} className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={state.selected}
                            onCheckedChange={(checked) =>
                              setDraft({
                                ...draft,
                                poles: {
                                  ...draft.poles,
                                  [pole.id]: { selected: checked === true, referent: checked === true ? state.referent : false },
                                },
                              })
                            }
                          />
                          {pole.name}
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant={state.referent ? "default" : "ghost"}
                          disabled={!state.selected}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              poles: {
                                ...draft.poles,
                                [pole.id]: { selected: true, referent: !state.referent },
                              },
                            })
                          }
                        >
                          Référent
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button disabled={save.isPending} onClick={() => (draft ? save.mutate(draft) : undefined)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
