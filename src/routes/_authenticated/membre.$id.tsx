import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAction, membersQuery, polesQuery } from "@/lib/icc";

export const Route = createFileRoute("/_authenticated/membre/$id")({ component: MemberPage });

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MEMBER_ROLE_OPTIONS = [
  { value: "equipier", label: "Équipier" },
  { value: "referent", label: "Référent" },
  { value: "formation", label: "En formation" },
] as const;

type Draft = {
  first_name: string;
  last_name: string;
  base_role: string;
  login_email: string;
  photo_url: string;
  affiliations: string;
  arrival_month: string;
  arrival_year: string;
  birthday_day: string;
  birthday_month: string;
  training_start: string;
  training_end_planned: string;
  training_end_effective: string;
  training_done: boolean;
  is_icc: boolean;
  is_ejp: boolean;
  inactive_note: string;
  poles: Record<string, { selected: boolean; referent: boolean }>;
};

const blank = (): Draft => ({
  first_name: "", last_name: "", base_role: "equipier", login_email: "", photo_url: "", affiliations: "",
  arrival_month: "", arrival_year: "", birthday_day: "", birthday_month: "", training_start: "",
  training_end_planned: "", training_end_effective: "", training_done: false, is_icc: false, is_ejp: false,
  inactive_note: "", poles: {},
});

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join(""); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }

function MemberPage() {
  const { id } = Route.useParams(); const isNew = id === "nouveau"; const navigate = useNavigate(); const qc = useQueryClient();
  const { isAdmin, member: actor } = useCurrentRole(); const members = useQuery(membersQuery); const poles = useQuery(polesQuery);
  const row = isNew ? null : (members.data?.members ?? []).find((m) => m.id === id) as any;
  const links = (members.data?.links ?? []).filter((l) => l.member_id === id);
  const [editing, setEditing] = useState(isNew); const [draft, setDraft] = useState<Draft>(blank()); const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const poleNames = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);
  const activePoles = useMemo(() => (poles.data ?? []).filter((p) => !p.archived), [poles.data]);

  useEffect(() => {
    if (!row) return;
    const pm: Draft["poles"] = {}; for (const l of links) pm[l.pole_id] = { selected: true, referent: l.is_referent };
    const derivedRole = row.training_start && !row.training_done ? "formation" : pm && Object.values(pm).some((p) => p.referent) ? "referent" : "equipier";
    setDraft({ first_name: row.first_name ?? "", last_name: row.last_name ?? "", base_role: derivedRole, login_email: row.login_email ?? "", photo_url: row.photo_url ?? "", affiliations: row.affiliations ?? "", arrival_month: row.arrival_month ? String(row.arrival_month) : "", arrival_year: row.arrival_year ? String(row.arrival_year) : "", birthday_day: row.birthday_day ? String(row.birthday_day) : "", birthday_month: row.birthday_month ? String(row.birthday_month) : "", training_start: row.training_start ?? "", training_end_planned: row.training_end_planned ?? "", training_end_effective: row.training_end_effective ?? "", training_done: !!row.training_done, is_icc: !!row.is_icc, is_ejp: !!row.is_ejp, inactive_note: row.inactive_note ?? "", poles: pm });
  }, [row?.id, members.data?.links]);

  async function uploadPhoto(file: File) {
    if (!isAdmin) return; if (!file.type.startsWith("image/")) return void toast.error("Choisis un fichier image."); if (file.size > 5 * 1024 * 1024) return void toast.error("La photo ne doit pas dépasser 5 Mo.");
    setUploadingPhoto(true); try { const ext=file.name.split(".").pop()?.toLowerCase()||"jpg",folder=isNew?"nouveaux":id,path=`${folder}/${crypto.randomUUID()}.${ext}`; const {error}=await supabase.storage.from("member-photos").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type}); if(error)throw error; const {data}=supabase.storage.from("member-photos").getPublicUrl(path); setDraft(c=>({...c,photo_url:data.publicUrl})); toast.success("Photo ajoutée"); } catch(error:any){toast.error("Impossible d'ajouter la photo",{description:error?.message??"Erreur inconnue"})} finally{setUploadingPhoto(false)}
  }

  const save = useMutation({ mutationFn: async () => {
    if (!isAdmin) throw new Error("Action non autorisée."); const full_name=`${draft.first_name.trim()} ${draft.last_name.trim()}`.trim(); if(!full_name)throw new Error("Le nom du membre est obligatoire."); const memberId=isNew?crypto.randomUUID():id;
    const isFormation = draft.base_role === "formation";
    const isReferent = draft.base_role === "referent";
    if (isReferent && !Object.values(draft.poles).some((p) => p.selected && p.referent)) throw new Error("Pour le rôle Référent, sélectionne au moins un pôle et active Référent sur ce pôle.");
    const trainingStart = isFormation ? (draft.training_start || new Date().toISOString().slice(0,10)) : draft.training_start;
    const payload:any={first_name:draft.first_name.trim()||null,last_name:draft.last_name.trim()||null,full_name,base_role:isReferent?"referent":"equipier",login_email:draft.login_email.trim()||null,photo_url:draft.photo_url.trim()||null,affiliations:draft.affiliations.trim()||null,arrival_month:draft.arrival_month?Number(draft.arrival_month):null,arrival_year:draft.arrival_year?Number(draft.arrival_year):null,birthday_day:draft.birthday_day?Number(draft.birthday_day):null,birthday_month:draft.birthday_month?Number(draft.birthday_month):null,training_start:trainingStart||null,training_end_planned:draft.training_end_planned||null,training_end_effective:draft.training_end_effective||null,training_done:isFormation?false:draft.training_done,is_icc:draft.is_icc,is_ejp:draft.is_ejp,inactive_note:draft.inactive_note.trim()||null,status:isNew?"active":row?.status??"active"};
    const write:any=supabase.from("members"); const res=isNew?await write.insert({id:memberId,...payload}):await write.update(payload).eq("id",memberId); if(res.error)throw new Error(res.error.message);
    const del=await supabase.from("member_poles").delete().eq("member_id",memberId); if(del.error)throw new Error(del.error.message);
    const poleRows=Object.entries(draft.poles).filter(([,v])=>v.selected).map(([pole_id,v])=>({member_id:memberId,pole_id,is_referent:isReferent?v.referent:false})); if(poleRows.length){const insert=await supabase.from("member_poles").insert(poleRows);if(insert.error)throw new Error(insert.error.message)}
    await logAction({action:isNew?"membre_cree":"membre_modifie",entity:"member",entityId:memberId,detail:full_name,actorName:actor?.full_name}); return memberId;
  }, onSuccess:async(memberId)=>{toast.success("Fiche membre enregistrée");await qc.invalidateQueries({queryKey:["members"]});if(isNew)navigate({to:"/membre/$id",params:{id:memberId}});else setEditing(false)}, onError:(error:Error)=>toast.error(error.message)});

  const setStatus=useMutation({mutationFn:async(status:"active"|"inactive"|"archived")=>{if(!isAdmin||!row)throw new Error("Action non autorisée.");const{error}=await supabase.from("members").update({status}as any).eq("id",row.id);if(error)throw new Error(error.message);await logAction({action:`membre_${status}`,entity:"member",entityId:row.id,detail:row.full_name,actorName:actor?.full_name})},onSuccess:async()=>{await qc.invalidateQueries({queryKey:["members"]});toast.success("Statut du membre mis à jour")},onError:(error:Error)=>toast.error(error.message)});

  if(!isNew&&members.isLoading)return <AppShell title="Fiche membre"><p>Chargement…</p></AppShell>; if(!isNew&&!row)return <AppShell title="Fiche membre"><EmptyState title="Membre introuvable"/></AppShell>; if(isNew&&!isAdmin)return <AppShell title="Nouveau membre"><EmptyState title="Accès réservé"/></AppShell>;
  const statusLabel=row?.status==="archived"?"Archivé":row?.status==="inactive"?"Inactif":row?.training_start&&!row?.training_done?"En formation":"Actif"; const memberPoles=links.map(l=>({...l,name:poleNames.get(l.pole_id)??"Pôle"})); const referentPoles=memberPoles.filter(p=>p.is_referent);

  return <AppShell title={isNew?"Nouveau membre":row.full_name} subtitle={isNew?"Créer une fiche membre":"Fiche membre"} actions={!isNew&&isAdmin?<Button size="sm" variant="outline" onClick={()=>setEditing(!editing)}>{editing?"Fermer la modification":"Modifier"}</Button>:undefined}>
    {!editing&&row?<div className="space-y-5"><div className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-start gap-4"><Avatar className="size-24"><AvatarImage src={row.photo_url??undefined}/><AvatarFallback>{initials(row.full_name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-icc-violet">{row.full_name}</h2><Badge>{statusLabel}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-1">{referentPoles.length?<><Badge variant="outline">🏅 Référent</Badge><strong className="text-sm">{referentPoles.map(p=>p.name).join(" · ")}</strong></>:null}{row.is_icc?<Badge variant="secondary">ICC</Badge>:null}{row.is_ejp?<Badge variant="secondary">EJP</Badge>:null}</div>{row.login_email?<p className="mt-3 text-sm text-muted-foreground">{row.login_email}</p>:null}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Intégration" value={row.arrival_year?`${row.arrival_month?`${MONTHS[row.arrival_month-1]} `:""}${row.arrival_year}`:"—"}/><Info label="Anniversaire" value={row.birthday_day&&row.birthday_month?`${row.birthday_day} ${MONTHS[row.birthday_month-1]}`:"—"}/><Info label="Pôles" value={memberPoles.length?memberPoles.map(p=>p.name).join(" · "):"—"}/><Info label="Formation" value={row.training_start?`${new Date(row.training_start).toLocaleDateString("fr-FR")}${row.training_done?" · terminée":" · en cours"}`:"—"}/></div>{row.affiliations?<div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm"><b>Informations</b><p className="mt-1">{row.affiliations}</p></div>:null}{row.inactive_note?<div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm"><b>Précision d'inactivité</b><p className="mt-1">{row.inactive_note}</p></div>:null}</div>{isAdmin?<div className="rounded-2xl border p-4"><h3 className="font-black text-icc-violet">Actions de gestion</h3><div className="mt-3 flex flex-wrap gap-2">{row.status!=="active"?<Button size="sm" variant="outline" onClick={()=>setStatus.mutate("active")}>Rendre actif</Button>:null}{row.status==="active"?<Button size="sm" variant="outline" onClick={()=>setStatus.mutate("inactive")}>Rendre inactif</Button>:null}{row.status!=="archived"?<Button size="sm" variant="ghost" onClick={()=>{if(window.confirm(`Archiver « ${row.full_name} » ? La fiche restera conservée et gérable dans Archives & corbeille.`))setStatus.mutate("archived")}}>Archiver</Button>:null}</div></div>:null}</div>:
    <div className="space-y-5 rounded-2xl border bg-card p-5"><div className="rounded-xl border border-dashed p-4"><p className="mb-3 text-xs font-semibold text-muted-foreground">Photo du membre</p><div className="flex flex-wrap items-center gap-4"><Avatar className="size-20"><AvatarImage src={draft.photo_url||undefined}/><AvatarFallback>{initials(`${draft.first_name} ${draft.last_name}`.trim()||"Membre")}</AvatarFallback></Avatar><div className="space-y-2"><Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingPhoto} onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(f);e.currentTarget.value=""}}/><p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF · 5 Mo maximum</p>{draft.photo_url?<Button type="button" size="sm" variant="ghost" onClick={()=>setDraft({...draft,photo_url:""})}>Retirer la photo</Button>:null}</div></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Prénom"><Input value={draft.first_name} onChange={e=>setDraft({...draft,first_name:e.target.value})}/></Field><Field label="Nom"><Input value={draft.last_name} onChange={e=>setDraft({...draft,last_name:e.target.value})}/></Field><Field label="Rôle"><Select value={draft.base_role} onValueChange={value=>setDraft({...draft,base_role:value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{MEMBER_ROLE_OPTIONS.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></Field><Field label="E-mail"><Input type="email" value={draft.login_email} onChange={e=>setDraft({...draft,login_email:e.target.value})}/></Field><Field label="Anniversaire - jour"><Input type="number" min="1" max="31" value={draft.birthday_day} onChange={e=>setDraft({...draft,birthday_day:e.target.value})}/></Field><Field label="Anniversaire - mois"><Input type="number" min="1" max="12" value={draft.birthday_month} onChange={e=>setDraft({...draft,birthday_month:e.target.value})}/></Field><Field label="Mois d'intégration"><Input type="number" min="1" max="12" value={draft.arrival_month} onChange={e=>setDraft({...draft,arrival_month:e.target.value})}/></Field><Field label="Année d'intégration"><Input type="number" min="2000" max="2100" value={draft.arrival_year} onChange={e=>setDraft({...draft,arrival_year:e.target.value})}/></Field><Field label="Début de formation"><Input type="date" value={draft.training_start} onChange={e=>setDraft({...draft,training_start:e.target.value})}/></Field><Field label="Fin prévue"><Input type="date" value={draft.training_end_planned} onChange={e=>setDraft({...draft,training_end_planned:e.target.value})}/></Field><Field label="Fin effective"><Input type="date" value={draft.training_end_effective} onChange={e=>setDraft({...draft,training_end_effective:e.target.value})}/></Field></div>
    <Field label="Informations / affiliations"><Textarea value={draft.affiliations} onChange={e=>setDraft({...draft,affiliations:e.target.value})}/></Field><Field label="Précision en cas d'inactivité"><Textarea value={draft.inactive_note} onChange={e=>setDraft({...draft,inactive_note:e.target.value})}/></Field><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><Checkbox checked={draft.is_icc} onCheckedChange={v=>setDraft({...draft,is_icc:v===true})}/> ICC</label><label className="flex items-center gap-2"><Checkbox checked={draft.is_ejp} onCheckedChange={v=>setDraft({...draft,is_ejp:v===true})}/> EJP</label><label className="flex items-center gap-2"><Checkbox checked={draft.training_done} onCheckedChange={v=>setDraft({...draft,training_done:v===true})}/> Formation terminée</label></div>
    <div><h3 className="mb-2 font-black text-icc-violet">Pôles et responsabilités</h3><div className="space-y-2">{activePoles.map(pole=>{const state=draft.poles[pole.id]??{selected:false,referent:false};return <div key={pole.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><label className="flex items-center gap-2"><Checkbox checked={state.selected} onCheckedChange={v=>setDraft({...draft,poles:{...draft.poles,[pole.id]:{selected:v===true,referent:v===true?state.referent:false}}})}/>{pole.name}</label><Button type="button" size="sm" variant={state.referent?"default":"outline"} disabled={!state.selected||draft.base_role!=="referent"} onClick={()=>setDraft({...draft,poles:{...draft.poles,[pole.id]:{selected:true,referent:!state.referent}}})}>Référent</Button></div>})}</div></div>
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={()=>isNew?navigate({to:"/trombinoscope"}):setEditing(false)}>Annuler</Button><Button disabled={save.isPending||uploadingPhoto} onClick={()=>save.mutate()}>Enregistrer</Button></div></div>}
  </AppShell>;
}
