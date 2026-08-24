import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/AppShell";
import { Field, newId } from "@/components/admin/form-kit";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  logAction,
  polesQuery,
  programsQuery,
  STATUS_LABEL,
  type ProgramWithDetails,
} from "@/lib/icc";
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
import { Textarea } from "@/components/ui/textarea";

const STATUSES = ["unconfirmed", "confirmed", "cancelled", "done"] as const;
const IMPORTANCES = ["normale", "haute", "critique"] as const;

type Draft = {
  id: string | null;
  title: string;
  description: string;
  program_type: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  location: string;
  status: string;
  importance: string;
  general_note: string;
  poles: Record<string, { selected: boolean; tasks: string }>;
};

function emptyDraft(): Draft {
  return {
    id: null,
    title: "",
    description: "",
    program_type: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    location: "",
    status: "unconfirmed",
    importance: "normale",
    general_note: "",
    poles: {},
  };
}

export function AdminProgrammes() {
  const programs = useQuery(programsQuery);
  const poles = useQuery(polesQuery);
  const queryClient = useQueryClient();
  const { member: actor } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const activePoles = useMemo(() => (poles.data ?? []).filter((p) => !p.archived), [poles.data]);
  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const title = value.title.trim();
      if (!title) throw new Error("Le titre du programme est obligatoire.");
      const id = value.id ?? newId("p");
      const payload = {
        title,
        description: value.description.trim() || null,
        program_type: value.program_type.trim() || null,
        start_date: value.start_date || null,
        start_time: value.start_time || null,
        end_date: value.end_date || null,
        end_time: value.end_time || null,
        location: value.location.trim() || null,
        status: value.status,
        importance: value.importance,
        general_note: value.general_note.trim() || null,
      };

      if (value.id) {
        const { error } = await supabase.from("programs").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("programs").insert({ id, ...payload });
        if (error) throw new Error(error.message);
      }

      // Affectations de pôles : remplacement complet, sans doublon possible.
      const { error: delError } = await supabase.from("program_assignments").delete().eq("program_id", id);
      if (delError) throw new Error(delError.message);
      const rows = Object.entries(value.poles)
        .filter(([, v]) => v.selected)
        .map(([poleId, v]) => ({ program_id: id, pole_id: poleId, tasks: v.tasks.trim() || null }));
      if (rows.length > 0) {
        const { error: insError } = await supabase.from("program_assignments").insert(rows);
        if (insError) throw new Error(insError.message);
      }

      await logAction({
        action: value.id ? "programme_modifie" : "programme_cree",
        entity: "program",
        entityId: id,
        detail: title,
        actorName: actor?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Programme enregistré");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) => toast.error("Enregistrement impossible", { description: error.message }),
  });

  const archive = useMutation({
    mutationFn: async (program: ProgramWithDetails) => {
      const { error } = await supabase
        .from("programs")
        .update({ archived: !program.archived })
        .eq("id", program.id);
      if (error) throw new Error(error.message);
      await logAction({
        action: program.archived ? "programme_reactive" : "programme_archive",
        entity: "program",
        entityId: program.id,
        detail: program.title,
        actorName: actor?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Programme mis à jour");
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) => toast.error("Action impossible", { description: error.message }),
  });

  function edit(program: ProgramWithDetails) {
    const map: Draft["poles"] = {};
    for (const a of program.assignments) map[a.pole_id] = { selected: true, tasks: a.tasks ?? "" };
    setDraft({
      id: program.id,
      title: program.title,
      description: program.description ?? "",
      program_type: program.program_type ?? "",
      start_date: program.start_date ?? "",
      start_time: program.start_time ?? "",
      end_date: program.end_date ?? "",
      end_time: program.end_time ?? "",
      location: program.location ?? "",
      status: program.status,
      importance: program.importance ?? "normale",
      general_note: program.general_note ?? "",
      poles: map,
    });
  }

  if (programs.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const list = programs.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{list.length} programme(s)</p>
        <Button size="sm" onClick={() => setDraft(emptyDraft())}>
          Nouveau programme
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Aucun programme" description="Créez le premier programme du service." />
      ) : (
        <div className="space-y-3">
          {list.map((program) => (
            <Card key={program.id} className={program.archived ? "opacity-60" : ""}>
              <CardHeader className="gap-1 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{program.title}</CardTitle>
                  <Badge variant="secondary">{STATUS_LABEL[program.status] ?? program.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(program.start_date)}
                  {program.location ? ` · ${program.location}` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {program.assignments.length === 0
                    ? "Aucun pôle affecté"
                    : program.assignments.map((a) => poleName.get(a.pole_id) ?? "Pôle").join(", ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => edit(program)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate(program)}
                  >
                    {program.archived ? "Réactiver" : "Archiver"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier le programme" : "Nouveau programme"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <Field label="Titre" htmlFor="p-title">
                <Input
                  id="p-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date de début" htmlFor="p-start">
                  <Input
                    id="p-start"
                    type="date"
                    value={draft.start_date}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  />
                </Field>
                <Field label="Heure de début" htmlFor="p-start-time">
                  <Input
                    id="p-start-time"
                    type="time"
                    value={draft.start_time}
                    onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                  />
                </Field>
                <Field label="Date de fin" htmlFor="p-end">
                  <Input
                    id="p-end"
                    type="date"
                    value={draft.end_date}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  />
                </Field>
                <Field label="Heure de fin" htmlFor="p-end-time">
                  <Input
                    id="p-end-time"
                    type="time"
                    value={draft.end_time}
                    onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Lieu" htmlFor="p-loc">
                <Input
                  id="p-loc"
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Statut">
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Importance">
                  <Select value={draft.importance} onValueChange={(v) => setDraft({ ...draft, importance: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORTANCES.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i.charAt(0).toUpperCase() + i.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Type" htmlFor="p-type">
                <Input
                  id="p-type"
                  placeholder="Culte, répétition, événement…"
                  value={draft.program_type}
                  onChange={(e) => setDraft({ ...draft, program_type: e.target.value })}
                />
              </Field>

              <Field label="Description" htmlFor="p-desc">
                <Textarea
                  id="p-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>

              <Field label="Note générale" htmlFor="p-note">
                <Textarea
                  id="p-note"
                  rows={2}
                  value={draft.general_note}
                  onChange={(e) => setDraft({ ...draft, general_note: e.target.value })}
                />
              </Field>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pôles mobilisés</p>
                <div className="space-y-3 rounded-lg border border-border p-3">
                  {activePoles.map((pole) => {
                    const state = draft.poles[pole.id] ?? { selected: false, tasks: "" };
                    return (
                      <div key={pole.id} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={state.selected}
                            onCheckedChange={(checked) =>
                              setDraft({
                                ...draft,
                                poles: {
                                  ...draft.poles,
                                  [pole.id]: { selected: checked === true, tasks: state.tasks },
                                },
                              })
                            }
                          />
                          {pole.name}
                        </label>
                        {state.selected ? (
                          <Input
                            placeholder="Tâches confiées à ce pôle"
                            value={state.tasks}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                poles: { ...draft.poles, [pole.id]: { selected: true, tasks: e.target.value } },
                              })
                            }
                          />
                        ) : null}
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
