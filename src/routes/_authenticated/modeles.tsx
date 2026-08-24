import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ArchiveRestore, Copy, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Field, newId } from "@/components/admin/form-kit";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAction, polesQuery, programModelsQuery, type ProgramModel } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/modeles")({
  head: () => ({
    meta: [
      { title: "Modèles de programme — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Modèles réutilisables de programmes du pôle Communication : pôles mobilisés, tâches et checklist préremplies.",
      },
      { property: "og:title", content: "Modèles de programme — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Créer un programme en un clic depuis un modèle validé, sans ressaisie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Modeles,
});

type Draft = {
  id: string | null;
  name: string;
  description: string;
  program_type: string;
  format: string;
  audience: string;
  tasks: string;
  poles: string[];
  checklist: string;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  description: "",
  program_type: "",
  format: "",
  audience: "",
  tasks: "",
  poles: [],
  checklist: "",
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function Modeles() {
  const models = useQuery(programModelsQuery);
  const poles = useQuery(polesQuery);
  const queryClient = useQueryClient();
  const { isStaff, member } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const poleName = new Map((poles.data ?? []).map((p) => [p.id, p.name]));
  const rows = (models.data ?? []).filter((m) => (showArchived ? m.archived : !m.archived));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["program-models"] });
  }

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const name = value.name.trim();
      if (!name) throw new Error("Le nom du modèle est obligatoire.");
      const checklist = value.checklist
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const payload = {
        name,
        description: value.description.trim() || null,
        program_type: value.program_type.trim() || null,
        format: value.format.trim() || null,
        audience: value.audience.trim() || null,
        tasks: value.tasks.trim() || null,
        poles: value.poles,
        checklist,
      };
      if (value.id) {
        const { error } = await supabase.from("program_models").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("program_models")
          .insert({ id: newId("mdl"), ...payload });
        if (error) throw new Error(error.message);
      }
      await logAction({
        action: value.id ? "modele_modifie" : "modele_cree",
        entity: "program_model",
        entityId: value.id ?? name,
        detail: name,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Modèle enregistré");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async (model: ProgramModel) => {
      const { error } = await supabase
        .from("program_models")
        .update({ archived: !model.archived })
        .eq("id", model.id);
      if (error) throw new Error(error.message);
      await logAction({
        action: model.archived ? "modele_restaure" : "modele_archive",
        entity: "program_model",
        entityId: model.id,
        detail: model.name,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Modèle mis à jour");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Un modèle génère un programme réel : la donnée n'est saisie qu'une seule fois. */
  const instantiate = useMutation({
    mutationFn: async (model: ProgramModel) => {
      const programId = newId("prg");
      const { error } = await supabase.from("programs").insert({
        id: programId,
        title: model.name,
        description: model.description,
        program_type: model.program_type,
        format: model.format,
        audience: model.audience,
        status: "draft",
        general_note: model.tasks,
      });
      if (error) throw new Error(error.message);

      for (const poleId of asStringArray(model.poles)) {
        const { error: assignError } = await supabase
          .from("program_assignments")
          .insert({ program_id: programId, pole_id: poleId, tasks: model.tasks });
        if (assignError) throw new Error(assignError.message);
      }

      const checklist = asStringArray(model.checklist);
      if (checklist.length > 0) {
        const { error: listError } = await supabase.from("program_checklist_items").insert(
          checklist.map((label, index) => ({
            program_id: programId,
            label,
            sort_order: index,
          })),
        );
        if (listError) throw new Error(listError.message);
      }

      await logAction({
        action: "programme_cree_depuis_modele",
        entity: "program",
        entityId: programId,
        detail: model.name,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Programme créé en brouillon depuis le modèle");
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Modèles de programme"
      subtitle="Structures réutilisables : pôles, tâches et checklist préremplies"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Voir les modèles actifs" : "Voir les archives"}
          </Button>
          {isStaff ? (
            <Button size="sm" className="gap-1" onClick={() => setDraft({ ...EMPTY })}>
              <Plus className="size-4" /> Nouveau modèle
            </Button>
          ) : null}
        </>
      }
    >
      {models.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={showArchived ? "Aucun modèle archivé" : "Aucun modèle"}
          description="Un modèle permet de créer un programme complet sans ressaisir les pôles et les tâches."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((model) => (
            <Card key={model.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black">{model.name}</p>
                  {model.program_type ? <Badge variant="secondary">{model.program_type}</Badge> : null}
                </div>
                {model.description ? (
                  <p className="text-sm text-muted-foreground">{model.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {asStringArray(model.poles).map((id) => (
                    <Badge key={id} variant="outline">
                      {poleName.get(id) ?? id}
                    </Badge>
                  ))}
                </div>
                {asStringArray(model.checklist).length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {asStringArray(model.checklist).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
                {isStaff ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={instantiate.isPending || model.archived}
                      onClick={() => instantiate.mutate(model)}
                    >
                      <Copy className="size-4" /> Créer un programme
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        setDraft({
                          id: model.id,
                          name: model.name,
                          description: model.description ?? "",
                          program_type: model.program_type ?? "",
                          format: model.format ?? "",
                          audience: model.audience ?? "",
                          tasks: model.tasks ?? "",
                          poles: asStringArray(model.poles),
                          checklist: asStringArray(model.checklist).join("\n"),
                        })
                      }
                    >
                      <Pencil className="size-4" /> Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      disabled={toggleArchive.isPending}
                      onClick={() => toggleArchive.mutate(model)}
                    >
                      {model.archived ? (
                        <>
                          <ArchiveRestore className="size-4" /> Restaurer
                        </>
                      ) : (
                        <>
                          <Archive className="size-4" /> Archiver
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <Field label="Nom du modèle" htmlFor="mdl-name">
                <Input
                  id="mdl-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Type">
                  <Input
                    value={draft.program_type}
                    onChange={(e) => setDraft({ ...draft, program_type: e.target.value })}
                  />
                </Field>
                <Field label="Format">
                  <Input
                    value={draft.format}
                    onChange={(e) => setDraft({ ...draft, format: e.target.value })}
                  />
                </Field>
                <Field label="Public">
                  <Input
                    value={draft.audience}
                    onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Tâches types">
                <Textarea
                  rows={2}
                  value={draft.tasks}
                  onChange={(e) => setDraft({ ...draft, tasks: e.target.value })}
                />
              </Field>
              <Field label="Pôles mobilisés">
                <div className="flex flex-wrap gap-1.5">
                  {(poles.data ?? [])
                    .filter((p) => !p.archived)
                    .map((pole) => {
                      const selected = draft.poles.includes(pole.id);
                      return (
                        <button
                          key={pole.id}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              poles: selected
                                ? draft.poles.filter((id) => id !== pole.id)
                                : [...draft.poles, pole.id],
                            })
                          }
                          className={
                            selected
                              ? "rounded-full bg-icc-violet px-3 py-1 text-xs font-bold text-white"
                              : "rounded-full border border-input px-3 py-1 text-xs"
                          }
                        >
                          {pole.name}
                        </button>
                      );
                    })}
                </div>
              </Field>
              <Field label="Checklist (une ligne par étape)">
                <Textarea
                  rows={4}
                  value={draft.checklist}
                  onChange={(e) => setDraft({ ...draft, checklist: e.target.value })}
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
