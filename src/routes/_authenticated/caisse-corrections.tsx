import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RotateCcw, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAction, membersQuery } from "@/lib/icc";

export const Route = createFileRoute("/_authenticated/caisse-corrections")({
  head: () => ({ meta: [{ title: "Corrections de caisse — COM ICC Le Mans" }] }),
  component: Page,
});

const db = () => supabase as any;
const euro = (v: any) => Number(v ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
type Kind = "contribution" | "entry" | "expense";
type Target = { id: string; kind: Kind; label: string; date: string; originalAmount: number; currentAmount: number };

function Page() {
  const qc = useQueryClient();
  const { member, userId, isTechAdmin } = useCurrentRole();
  const members = useQuery(membersQuery);
  const permission = useQuery({
    queryKey: ["finance-corrections-permission", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db().rpc("has_team_finance_permission", { p_action: "administrer" });
      if (error) throw error;
      return Boolean(data);
    },
  });
  const canAdmin = isTechAdmin || permission.data === true;

  const contributions = useQuery({
    queryKey: ["finance-correction-contributions"], enabled: canAdmin,
    queryFn: async () => { const { data, error } = await db().from("team_finance_contributions").select("*").eq("status", "confirmed").order("paid_on", { ascending: false }); if (error) throw error; return data ?? []; },
  });
  const entries = useQuery({
    queryKey: ["finance-correction-entries"], enabled: canAdmin,
    queryFn: async () => { const { data, error } = await db().from("team_finance_entries").select("*").eq("status", "approved").order("entry_date", { ascending: false }); if (error) throw error; return data ?? []; },
  });
  const expenses = useQuery({
    queryKey: ["finance-correction-expenses"], enabled: canAdmin,
    queryFn: async () => { const { data, error } = await db().from("team_finance_expenses").select("*").eq("status", "approved").order("expense_date", { ascending: false }); if (error) throw error; return data ?? []; },
  });
  const corrections = useQuery({
    queryKey: ["finance-corrections"], enabled: canAdmin,
    queryFn: async () => { const { data, error } = await db().from("team_finance_corrections").select("*").order("created_at", { ascending: false }); if (error) throw error; return data ?? []; },
  });

  const names = useMemo(() => new Map((members.data?.members ?? []).map((m: any) => [m.id, m.full_name])), [members.data]);
  const correctionSum = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of corrections.data ?? []) {
      const k = `${c.target_kind}|${c.target_id}`;
      map.set(k, (map.get(k) ?? 0) + Number(c.amount_delta ?? 0));
    }
    return map;
  }, [corrections.data]);

  const targets = useMemo<Target[]>(() => {
    const out: Target[] = [];
    for (const c of contributions.data ?? []) {
      const original = Number(c.amount ?? 0), delta = correctionSum.get(`contribution|${c.id}`) ?? 0;
      out.push({ id: c.id, kind: "contribution", label: `${names.get(c.member_id) ?? "Membre"} · Cotisation`, date: c.paid_on, originalAmount: original, currentAmount: original + delta });
    }
    for (const e of entries.data ?? []) {
      const original = Number(e.amount ?? 0), delta = correctionSum.get(`entry|${e.id}`) ?? 0;
      out.push({ id: e.id, kind: "entry", label: e.public_label ?? "Entrée", date: e.entry_date, originalAmount: original, currentAmount: original + delta });
    }
    for (const x of expenses.data ?? []) {
      const original = Number(x.amount ?? 0), delta = correctionSum.get(`expense|${x.id}`) ?? 0;
      out.push({ id: x.id, kind: "expense", label: x.public_label ?? "Dépense", date: x.expense_date, originalAmount: original, currentAmount: original - delta });
    }
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [contributions.data, entries.data, expenses.data, correctionSum, names]);

  const [target, setTarget] = useState<Target | null>(null);
  const [mode, setMode] = useState<"correct" | "cancel">("correct");
  const [newAmount, setNewAmount] = useState("");
  const [reason, setReason] = useState("");
  const [label, setLabel] = useState("");

  function open(t: Target, nextMode: "correct" | "cancel" = "correct") {
    setTarget(t); setMode(nextMode); setNewAmount(String(t.currentAmount)); setReason("");
    setLabel(`${nextMode === "cancel" ? "Annulation" : "Correction"} · ${t.label}`);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Écriture introuvable.");
      if (!reason.trim()) throw new Error("Le motif de la correction est obligatoire.");
      const sign = target.kind === "expense" ? -1 : 1;
      const wanted = mode === "cancel" ? 0 : Number(newAmount.replace(",", "."));
      if (!Number.isFinite(wanted) || wanted < 0) throw new Error("Nouveau montant invalide.");
      const delta = (wanted - target.currentAmount) * sign;
      if (Math.abs(delta) < 0.000001) throw new Error("Aucune différence à enregistrer.");
      const { data, error } = await db().from("team_finance_corrections").insert({
        target_kind: target.kind,
        target_id: target.id,
        correction_kind: mode,
        amount_delta: delta,
        public_label: label.trim() || `${mode === "cancel" ? "Annulation" : "Correction"} d’écriture`,
        private_detail: reason.trim(),
        created_by: userId,
      }).select("id").single();
      if (error) throw error;
      await logAction({
        action: mode === "cancel" ? "ecriture_caisse_annulee" : "ecriture_caisse_corrigee",
        entity: "team_finance",
        entityId: data.id,
        detail: `${target.label} · ${euro(target.currentAmount)} → ${euro(wanted)} · motif : ${reason.trim()}`,
        actorName: member?.full_name,
      });
    },
    onSuccess: async () => {
      toast.success(mode === "cancel" ? "Écriture annulée par contre-écriture" : "Correction enregistrée");
      setTarget(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["finance-corrections"] }),
        qc.invalidateQueries({ queryKey: ["finance-correction-contributions"] }),
        qc.invalidateQueries({ queryKey: ["finance-correction-entries"] }),
        qc.invalidateQueries({ queryKey: ["finance-correction-expenses"] }),
        qc.invalidateQueries({ queryKey: ["fin-summary"] }),
        qc.invalidateQueries({ queryKey: ["team-finance-summary"] }),
      ]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (permission.isLoading) return <AppShell title="Corrections de caisse"><p className="text-sm text-muted-foreground">Vérification des droits…</p></AppShell>;
  if (!canAdmin) return <AppShell title="Corrections de caisse" subtitle="Cette zone est réservée aux personnes autorisées."><Card><CardContent className="p-6"><p className="font-semibold">Vous pouvez consulter la caisse, mais vous n’avez pas le droit de corriger ou d’annuler une écriture.</p></CardContent></Card></AppShell>;

  return <AppShell title="Corrections de caisse" subtitle="Corriger sans effacer : chaque modification crée une contre-écriture traçable.">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />Principe de sécurité</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">L’écriture d’origine n’est jamais supprimée ni modifiée silencieusement. Une correction ajoute uniquement la différence nécessaire au solde. Si une écriture a déjà été corrigée, le nouveau calcul part du montant effectif actuel, pas du montant d’origine.</CardContent>
    </Card>

    <Card className="mt-4">
      <CardHeader><CardTitle>Écritures pouvant être corrigées</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {!targets.length ? <EmptyState title="Aucune écriture à corriger pour le moment" description="Dès qu’une cotisation est confirmée, une entrée validée ou une dépense validée existe, elle apparaîtra ici." /> : targets.map((t) => <div key={`${t.kind}-${t.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <div className="flex flex-wrap items-center gap-2"><b>{t.label}</b><Badge variant="outline">{t.kind === "expense" ? "Dépense" : t.kind === "entry" ? "Entrée" : "Cotisation"}</Badge></div>
            <p className="text-xs text-muted-foreground">{new Date(`${t.date}T12:00:00`).toLocaleDateString("fr-FR")} · montant d’origine {euro(t.originalAmount)} · montant effectif actuel <b>{euro(t.currentAmount)}</b></p>
          </div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => open(t, "correct")}><Wrench className="size-4" />Corriger</Button><Button size="sm" variant="outline" onClick={() => open(t, "cancel")}><RotateCcw className="size-4" />Annuler</Button></div>
        </div>)}
      </CardContent>
    </Card>

    {(corrections.data ?? []).length ? <Card className="mt-4"><CardHeader><CardTitle>Historique des corrections</CardTitle></CardHeader><CardContent className="space-y-2">{(corrections.data ?? []).map((c: any) => <div key={c.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><b>{c.public_label}</b><b className={Number(c.amount_delta) >= 0 ? "text-emerald-700" : "text-rose-700"}>{Number(c.amount_delta) >= 0 ? "+" : ""}{euro(c.amount_delta)}</b></div><p className="text-xs text-muted-foreground">{c.correction_kind === "cancel" ? "Annulation" : "Correction"} · {new Date(c.created_at).toLocaleString("fr-FR")}</p></div>)}</CardContent></Card> : null}

    <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "cancel" ? "Annuler une écriture" : "Corriger une écriture"}</DialogTitle></DialogHeader>
        {target ? <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-3 text-sm"><p><b>Écriture :</b> {target.label}</p><p><b>Montant effectif actuel :</b> {euro(target.currentAmount)}</p><p className="text-muted-foreground">L’original restera visible dans l’historique.</p></div>
          <div className="space-y-1"><Label>Action</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={mode} onChange={(e) => { const v = e.target.value as "correct" | "cancel"; setMode(v); setLabel(`${v === "cancel" ? "Annulation" : "Correction"} · ${target.label}`); }}><option value="correct">Corriger le montant</option><option value="cancel">Annuler complètement l’écriture</option></select></div>
          {mode === "correct" ? <div className="space-y-1"><Label>Nouveau montant</Label><Input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} inputMode="decimal" /></div> : null}
          <div className="space-y-1"><Label>Libellé visible dans le journal</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="space-y-1"><Label>Motif / explication *</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Expliquer la raison de la correction ou de l’annulation…" /></div>
        </div> : null}
        <DialogFooter><Button variant="ghost" onClick={() => setTarget(null)}>Fermer</Button><Button disabled={save.isPending || !reason.trim()} onClick={() => save.mutate()}>{mode === "cancel" ? "Confirmer l’annulation" : "Enregistrer la correction"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </AppShell>;
}
