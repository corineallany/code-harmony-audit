import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileDown, FileText, Link2, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { polesQuery } from "@/lib/icc";

export const Route = createFileRoute("/_authenticated/demande-materiel/$id")({
  head: () => ({ meta: [{ title: "Demande matériel — COM ICC Le Mans" }] }),
  component: Page,
});

const db = () => supabase as any;
const STATUS: Record<string, string> = {
  brouillon: "Brouillon",
  preparation: "Préparation",
  transmise: "Transmise",
  validee: "Validée",
  refusee: "Refusée",
  reportee: "Reportée",
  commandee: "Commandée",
  recue: "Reçue",
};
const PRIORITY: Record<string, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  critique: "Critique",
};
const euro = (n: unknown) => Number(n ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function Page() {
  const { id } = Route.useParams();
  const { userId, isTechAdmin } = useCurrentRole();
  const qc = useQueryClient();
  const poles = useQuery(polesQuery);

  const request = useQuery({
    queryKey: ["material-request", id],
    queryFn: async () => {
      const { data, error } = await db().from("material_requests").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const relations = useQuery({
    queryKey: ["material-request-relations", id],
    queryFn: async () => {
      const { data, error } = await db().from("material_request_needs").select("*").eq("request_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const needs = useQuery({
    queryKey: ["material-request-all-needs"],
    queryFn: async () => {
      const { data, error } = await db().from("material_needs").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const links = useQuery({
    queryKey: ["material-request-links"],
    queryFn: async () => {
      const { data, error } = await db().from("material_need_links").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const docs = useQuery({
    queryKey: ["material-request-docs", id],
    queryFn: async () => {
      const { data, error } = await db().from("material_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const permission = useQuery({
    queryKey: ["material-request-perm", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db().rpc("material_scope_for_user", { p_user: userId, p_action: "gerer_demandes" });
      if (error) throw error;
      return data as string;
    },
  });

  const canEdit = isTechAdmin || permission.data !== "interdit";
  const r = request.data;
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("preparation");
  const [churchRef, setChurchRef] = useState("");
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState("");

  useEffect(() => {
    if (!r) return;
    setTitle(r.title ?? "");
    setStatus(r.status ?? "preparation");
    setChurchRef(r.church_reference ?? "");
    setNotes(r.notes ?? "");
    setDecision(r.decision_note ?? "");
  }, [r]);

  const needIds = (relations.data ?? []).map((x: any) => x.need_id);
  const rows = (needs.data ?? []).filter((n: any) => needIds.includes(n.id));
  const poleName = new Map((poles.data ?? []).map((p: any) => [p.id, p.name]));
  const total = rows.reduce((sum: number, n: any) => sum + Number(n.estimated_budget ?? 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!r) throw new Error("Dossier introuvable");
      const patch: Record<string, unknown> = {
        title: title.trim(),
        status,
        church_reference: churchRef.trim() || null,
        notes: notes.trim() || null,
        decision_note: decision.trim() || null,
      };
      if (status === "transmise" && !r.sent_at) patch.sent_at = new Date().toISOString();
      if (["validee", "refusee", "reportee"].includes(status) && !r.decided_at) patch.decided_at = new Date().toISOString();
      const { error } = await db().from("material_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Dossier mis à jour");
      await qc.invalidateQueries({ queryKey: ["material-request", id] });
      await qc.invalidateQueries({ queryKey: ["material-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("material-com").createSignedUrl(path, 120);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (request.isLoading) return <AppShell title="Demande matériel"><p>Chargement…</p></AppShell>;
  if (!r) return <AppShell title="Demande matériel"><EmptyState title="Dossier introuvable" /></AppShell>;

  const requestDocs = (docs.data ?? []).filter((d: any) => d.entity_type === "request" && d.entity_id === id);

  return (
    <AppShell
      title={r.title}
      subtitle="Dossier de demande de matériel — finances de l’Église"
      actions={<Button variant="outline" onClick={() => window.print()}><FileDown className="size-4" />Imprimer / Enregistrer PDF</Button>}
    >
      <div className="print:hidden rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <b>Cette demande est indépendante de la Caisse fraternelle.</b>
        <p className="mt-1 text-muted-foreground">Elle sert à préparer, documenter et suivre une demande adressée aux finances de l’Église.</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Besoins inclus</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {rows.map((n: any) => {
                const nlinks = (links.data ?? []).filter((l: any) => l.need_id === n.id);
                const ndocs = (docs.data ?? []).filter((d: any) => d.entity_type === "need" && d.entity_id === n.id);
                return (
                  <div key={n.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black">{n.title}</h3>
                        <p className="text-xs text-muted-foreground">{poleName.get(n.pole_id) ?? "COM"} · Qté {n.quantity} · Priorité {PRIORITY[n.priority] ?? n.priority}</p>
                      </div>
                      <b>{euro(n.estimated_budget)}</b>
                    </div>
                    {n.justification ? <p className="mt-3 text-sm"><b>Justification :</b> {n.justification}</p> : null}
                    {n.alternative ? <p className="mt-2 text-sm"><b>Alternative :</b> {n.alternative}</p> : null}
                    {nlinks.length ? <div className="mt-3 flex flex-wrap gap-2 print:hidden">{nlinks.map((l: any) => <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"><Link2 className="size-3" />{l.label || "Lien produit"}</a>)}</div> : null}
                    {ndocs.length ? <div className="mt-3 flex flex-wrap gap-2 print:hidden">{ndocs.map((d: any) => <Button key={d.id} size="sm" variant="ghost" onClick={() => openDoc(d.storage_path)}><FileText className="size-4" />{d.file_name}</Button>)}</div> : null}
                  </div>
                );
              })}
              {!rows.length ? <EmptyState title="Aucun besoin rattaché" /> : null}
              <div className="rounded-xl bg-violet-50 p-4 text-right"><span className="text-sm">Budget estimatif total</span><b className="ml-3 text-xl text-icc-violet">{euro(total)}</b></div>
            </CardContent>
          </Card>

          {requestDocs.length ? <Card className="print:hidden"><CardHeader><CardTitle>Documents du dossier</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{requestDocs.map((d: any) => <Button key={d.id} variant="outline" onClick={() => openDoc(d.storage_path)}><FileText className="size-4" />{d.file_name}</Button>)}</CardContent></Card> : null}
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle>Suivi du dossier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canEdit ? (
              <>
                <Field label="Titre"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
                <Field label="Statut"><select className="h-10 w-full rounded-md border bg-background px-3" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Référence / n° de demande Église"><Input value={churchRef} onChange={(e) => setChurchRef(e.target.value)} placeholder="Ex. FIN-2026-018" /></Field>
                <Field label="Note de présentation"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                <Field label="Décision / retour des finances"><Textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="Validation, motif de report, précision…" /></Field>
                <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="size-4" />Enregistrer le suivi</Button>
              </>
            ) : (
              <>
                <Badge>{STATUS[r.status] ?? r.status}</Badge>
                {r.church_reference ? <p><b>Référence :</b> {r.church_reference}</p> : null}
                {r.notes ? <p className="text-sm">{r.notes}</p> : null}
                {r.decision_note ? <p className="text-sm"><b>Décision :</b> {r.decision_note}</p> : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 hidden print:block"><p className="text-xs text-muted-foreground">Document généré depuis l’application COM ICC Le Mans.</p></div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1 print:hidden"><Label>{label}</Label>{children}</div>;
}
