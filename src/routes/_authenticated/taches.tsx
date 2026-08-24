import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Field } from "@/components/admin/form-kit";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  logAction,
  membersQuery,
  polesQuery,
  programsQuery,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  tasksQuery,
  type Task,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/taches")({
  head: () => ({
    meta: [
      { title: "Tâches — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "To-do central du pôle Communication : tâches assignées, échéances, priorités et suivi d'avancement.",
      },
      { property: "og:title", content: "Tâches — COM ICC Le Mans" },
      { property: "og:description", content: "Suivi central des actions et échéances du pôle Communication." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Taches,
});

type Draft = {
  id: string | null;
  title: string;
  detail: string;
  due_date: string;
  priority: string;
  status: string;
  assignee_member_id: string;
  pole_id: string;
  program_id: string;
};

const EMPTY: Draft = {
  id: null,
  title: "",
  detail: "",
  due_date: "",
  priority: "normale",
  status: "todo",
  assignee_member_id: "",
  pole_id: "",
  program_id: "",
};

const COLUMNS: Array<{ status: string; label: string }> = [
  { status: "todo", label: "À faire" },
  { status: "doing", label: "En cours" },
  { status: "done", label: "Terminées" },
];

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Taches() {
  const tasks = useQuery(tasksQuery);
  const members = useQuery(membersQuery);
  const poles = useQuery(polesQuery);
  const programs = useQuery(programsQuery);
  const queryClient = useQueryClient();
  const { member, isStaff } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const memberName = new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name]));
  const poleName = new Map((poles.data ?? []).map((p) => [p.id, p.name]));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const title = value.title.trim();
      if (!title) throw new Error("Le titre de la tâche est obligatoire.");
      const payload = {
        title,
        detail: value.detail.trim() || null,
        due_date: value.due_date || null,
        priority: value.priority,
        status: value.status,
        assignee_member_id: value.assignee_member_id || null,
        pole_id: value.pole_id || null,
        program_id: value.program_id || null,
      };
      if (value.id) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("tasks").insert(payload);
        if (error) throw new Error(error.message);
      }
      await logAction({
        action: value.id ? "tache_modifiee" : "tache_creee",
        entity: "task",
        entityId: value.id ?? title,
        detail: title,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Tâche enregistrée");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error("Enregistrement impossible", { description: error.message }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ task, status }: { task: Task; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
      if (error) throw new Error(error.message);
      await logAction({
        action: "tache_statut",
        entity: "task",
        entityId: task.id,
        detail: `${task.title} → ${TASK_STATUS_LABEL[status] ?? status}`,
        actorName: member?.full_name,
      });
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error("Mise à jour impossible", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw new Error(error.message);
      await logAction({
        action: "tache_supprimee",
        entity: "task",
        entityId: task.id,
        detail: task.title,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Tâche supprimée");
      refresh();
    },
    onError: (error: Error) => toast.error("Suppression impossible", { description: error.message }),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell title="Tâches" subtitle="To-do central du pôle — source unique">
      <div className="mb-5 flex justify-end">
        {isStaff ? (
          <Button className="gap-2" onClick={() => setDraft(EMPTY)}>
            <Plus className="size-4" /> Nouvelle tâche
          </Button>
        ) : null}
      </div>

      {tasks.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((column) => {
            const list = (tasks.data ?? []).filter((t) => t.status === column.status);
            return (
              <Card key={column.status}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{column.label}</CardTitle>
                  <Badge variant="outline">{list.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {list.length === 0 ? (
                    <EmptyState title="Rien ici" />
                  ) : (
                    list.map((task) => {
                      const late = task.due_date && task.due_date < today && task.status !== "done";
                      return (
                        <div key={task.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{task.title}</p>
                            <Badge variant={task.priority === "haute" ? "destructive" : "outline"}>
                              {TASK_PRIORITY_LABEL[task.priority] ?? task.priority}
                            </Badge>
                          </div>
                          {task.detail ? (
                            <p className="mt-1 text-sm text-muted-foreground">{task.detail}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className={late ? "font-semibold text-destructive" : ""}>
                              {task.due_date ? formatDate(task.due_date) : "Sans échéance"}
                            </span>
                            {task.assignee_member_id ? (
                              <span>· {memberName.get(task.assignee_member_id) ?? task.assignee_member_id}</span>
                            ) : null}
                            {task.pole_id ? <span>· {poleName.get(task.pole_id) ?? task.pole_id}</span> : null}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <select
                              className={`${selectClass} h-8 w-auto`}
                              value={task.status}
                              onChange={(event) => setStatus.mutate({ task, status: event.target.value })}
                            >
                              {COLUMNS.map((c) => (
                                <option key={c.status} value={c.status}>
                                  {TASK_STATUS_LABEL[c.status]}
                                </option>
                              ))}
                            </select>
                            {isStaff ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setDraft({
                                      id: task.id,
                                      title: task.title,
                                      detail: task.detail ?? "",
                                      due_date: task.due_date ?? "",
                                      priority: task.priority,
                                      status: task.status,
                                      assignee_member_id: task.assignee_member_id ?? "",
                                      pole_id: task.pole_id ?? "",
                                      program_id: task.program_id ?? "",
                                    })
                                  }
                                >
                                  Modifier
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => remove.mutate(task)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <Field label="Titre" htmlFor="task-title">
                <Input
                  id="task-title"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
              </Field>
              <Field label="Détail" htmlFor="task-detail">
                <Textarea
                  id="task-detail"
                  value={draft.detail}
                  onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Échéance" htmlFor="task-due">
                  <Input
                    id="task-due"
                    type="date"
                    value={draft.due_date}
                    onChange={(event) => setDraft({ ...draft, due_date: event.target.value })}
                  />
                </Field>
                <Field label="Priorité">
                  <select
                    className={selectClass}
                    value={draft.priority}
                    onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
                  >
                    {Object.entries(TASK_PRIORITY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Statut">
                  <select
                    className={selectClass}
                    value={draft.status}
                    onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.status} value={c.status}>
                        {TASK_STATUS_LABEL[c.status]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assignée à">
                  <select
                    className={selectClass}
                    value={draft.assignee_member_id}
                    onChange={(event) => setDraft({ ...draft, assignee_member_id: event.target.value })}
                  >
                    <option value="">Non assignée</option>
                    {(members.data?.members ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pôle">
                  <select
                    className={selectClass}
                    value={draft.pole_id}
                    onChange={(event) => setDraft({ ...draft, pole_id: event.target.value })}
                  >
                    <option value="">Aucun</option>
                    {(poles.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Programme lié">
                  <select
                    className={selectClass}
                    value={draft.program_id}
                    onChange={(event) => setDraft({ ...draft, program_id: event.target.value })}
                  >
                    <option value="">Aucun</option>
                    {(programs.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
