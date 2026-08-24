import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/AppShell";
import { Field, newId } from "@/components/admin/form-kit";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAction, polesQuery, type Pole } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  id: string | null;
  name: string;
  pole_group: string;
  description: string;
  sort_order: number;
};

const EMPTY: Draft = { id: null, name: "", pole_group: "", description: "", sort_order: 0 };

export function AdminPoles() {
  const poles = useQuery(polesQuery);
  const queryClient = useQueryClient();
  const { member } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["poles"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const name = value.name.trim();
      if (!name) throw new Error("Le nom du pôle est obligatoire.");
      const payload = {
        name,
        pole_group: value.pole_group.trim() || null,
        description: value.description.trim() || null,
        sort_order: Number.isFinite(value.sort_order) ? value.sort_order : 0,
      };
      if (value.id) {
        const { error } = await supabase.from("poles").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("poles").insert(payload);
        if (error) throw new Error(error.message);
      }
      await logAction({
        action: value.id ? "pole_modifie" : "pole_cree",
        entity: "pole",
        entityId: value.id ?? name,
        detail: name,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Pôle enregistré");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error("Enregistrement impossible", { description: error.message }),
  });

  const toggleArchive = useMutation({
    mutationFn: async (pole: Pole) => {
      const { error } = await supabase.from("poles").update({ archived: !pole.archived }).eq("id", pole.id);
      if (error) throw new Error(error.message);
      await logAction({
        action: pole.archived ? "pole_reactive" : "pole_archive",
        entity: "pole",
        entityId: pole.id,
        detail: pole.name,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Pôle mis à jour");
      refresh();
    },
    onError: (error: Error) => toast.error("Action impossible", { description: error.message }),
  });

  if (poles.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const list = poles.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{list.length} pôle(s)</p>
        <Button
          size="sm"
          onClick={() => setDraft({ ...EMPTY, sort_order: list.length + 1, id: null })}
        >
          Nouveau pôle
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Aucun pôle" description="Créez le premier pôle du service." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((pole) => (
            <Card key={pole.id} className={pole.archived ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{pole.name}</CardTitle>
                  {pole.archived ? <Badge variant="outline">Archivé</Badge> : null}
                </div>
                {pole.pole_group ? (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{pole.pole_group}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {pole.description ? (
                  <p className="text-sm text-muted-foreground">{pole.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        id: pole.id,
                        name: pole.name,
                        pole_group: pole.pole_group ?? "",
                        description: pole.description ?? "",
                        sort_order: pole.sort_order,
                      })
                    }
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={toggleArchive.isPending}
                    onClick={() => toggleArchive.mutate(pole)}
                  >
                    {pole.archived ? "Réactiver" : "Archiver"}
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
            <DialogTitle>{draft?.id ? "Modifier le pôle" : "Nouveau pôle"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <Field label="Nom" htmlFor="pole-name">
                <Input
                  id="pole-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Groupe" htmlFor="pole-group">
                <Input
                  id="pole-group"
                  placeholder="Ex. Média, Technique…"
                  value={draft.pole_group}
                  onChange={(e) => setDraft({ ...draft, pole_group: e.target.value })}
                />
              </Field>
              <Field label="Description" htmlFor="pole-desc">
                <Textarea
                  id="pole-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
              <Field label="Ordre d'affichage" htmlFor="pole-order">
                <Input
                  id="pole-order"
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() => (draft ? save.mutate(draft) : undefined)}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
