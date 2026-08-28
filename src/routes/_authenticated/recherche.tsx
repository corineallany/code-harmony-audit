import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { AppShell, EmptyState } from "@/components/AppShell";
import {
  debriefsQuery,
  evaluationsQuery,
  formatDate,
  membersQuery,
  polesQuery,
  programsQuery,
  solicitationsQuery,
  tasksQuery,
} from "@/lib/icc";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/recherche")({
  head: () => ({ meta: [{ title: "Recherche universelle — COM ICC Le Mans" }] }),
  component: Recherche,
});

type Hit = { id: string; kind: string; title: string; detail: string; to: string };
type TrainingPath = { id: string; name: string; pole_id: string; path_kind: string; archived?: boolean };
type MemberTrainingPath = { id: string; member_id: string; path_id: string; status: string; started_at: string | null; completed_at: string | null };
type Objective = { id: string; evaluation_id: string; subject_member_id: string; label: string; status: string; due_date: string | null };
const KIND_LABEL: Record<string, string> = { member:"Membre",program:"Programme",solicitation:"Sollicitation",pole:"Pôle",task:"Tâche",training:"Formation",evaluation:"Évaluation",objective:"Objectif",debrief:"Post-service",material:"Matériel COM",material_need:"Besoin matériel",material_request:"Demande matériel",material_incident:"Incident matériel" };
function normalize(value: string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}

function Recherche(){
 const[term,setTerm]=useState("");
 const members=useQuery(membersQuery),programs=useQuery(programsQuery),solicitations=useQuery(solicitationsQuery),poles=useQuery(polesQuery),tasks=useQuery(tasksQuery),evaluations=useQuery(evaluationsQuery),debriefs=useQuery(debriefsQuery);const{member,isStaff}=useCurrentRole();
 const training=useQuery({queryKey:["search-training"],queryFn:async()=>{const[pathsRes,memberPathsRes]=await Promise.all([(supabase as any).from("training_paths").select("id, name, pole_id, path_kind, archived"),(supabase as any).from("member_training_paths").select("id, member_id, path_id, status, started_at, completed_at")]);if(pathsRes.error)throw new Error(pathsRes.error.message);if(memberPathsRes.error)throw new Error(memberPathsRes.error.message);return{paths:(pathsRes.data??[]) as TrainingPath[],memberPaths:(memberPathsRes.data??[]) as MemberTrainingPath[]}}});
 const objectives=useQuery({queryKey:["search-evaluation-objectives"],queryFn:async()=>{const{data,error}=await(supabase as any).from("evaluation_objectives").select("id, evaluation_id, subject_member_id, label, status, due_date");if(error)throw new Error(error.message);return(data??[]) as Objective[]}});
 const material=useQuery({queryKey:["search-material"],queryFn:async()=>{const db=supabase as any;const[items,needs,requests,incidents]=await Promise.all([db.from("material_items").select("id,name,category,brand,model,state,location,notes,primary_pole_id").eq("archived",false),db.from("material_needs").select("id,title,description,justification,alternative,status,priority,pole_id"),db.from("material_requests").select("id,title,notes,status,church_reference"),db.from("material_incidents").select("id,item_id,title,description,status,severity")]);for(const r of[items,needs,requests,incidents])if(r.error)throw new Error(r.error.message);return{items:items.data??[],needs:needs.data??[],requests:requests.data??[],incidents:incidents.data??[]}}});
 const hits=useMemo<Hit[]>(()=>{const q=normalize(term.trim());if(q.length<2)return[];const out:Hit[]=[];const memberById=new Map((members.data?.members??[]).map(m=>[m.id,m])),poleById=new Map((poles.data??[]).map(p=>[p.id,p])),programById=new Map((programs.data??[]).map(p=>[p.id,p])),itemById=new Map((material.data?.items??[]).map((x:any)=>[x.id,x]));
 for(const m of members.data?.members??[])out.push({id:`member-${m.id}`,kind:"member",title:m.full_name,detail:`${m.base_role} · ${m.status==="active"?"Actif":"Inactif"}`,to:`/membre/${m.id}`});
 for(const p of programs.data??[])out.push({id:`program-${p.id}`,kind:"program",title:p.title,detail:`${formatDate(p.start_date)}${p.location?` · ${p.location}`:""}`,to:"/programmes"});
 for(const s of solicitations.data??[])out.push({id:`solicitation-${s.id}`,kind:"solicitation",title:s.event_name??"Sollicitation",detail:`${s.requester??"Demandeur inconnu"} · ${formatDate(s.event_date)}`,to:"/sollicitations"});
 for(const p of poles.data??[])out.push({id:`pole-${p.id}`,kind:"pole",title:p.name,detail:p.description??p.pole_group??"Pôle",to:"/poles"});
 for(const t of tasks.data??[])out.push({id:`task-${t.id}`,kind:"task",title:t.title,detail:t.detail??t.status,to:"/taches"});
 for(const mp of training.data?.memberPaths??[]){const path=training.data?.paths.find(p=>p.id===mp.path_id);if(!path||path.path_kind!=="internal"||path.archived)continue;const person=memberById.get(mp.member_id),pole=poleById.get(path.pole_id);out.push({id:`training-${mp.id}`,kind:"training",title:`${path.name}${person?` — ${person.full_name}`:""}`,detail:`${pole?.name??"Pôle"} · ${mp.status==="completed"?"Validée":"En cours"}`,to:"/formations"})}
 for(const evaluation of evaluations.data??[]){if(evaluation.status!=="validated")continue;const isOwn=!!member?.id&&evaluation.subject_member_id===member.id;if(!isStaff&&!isOwn)continue;const person=memberById.get(evaluation.subject_member_id);out.push({id:`evaluation-${evaluation.id}`,kind:"evaluation",title:`Évaluation${person?` — ${person.full_name}`:""}`,detail:`${evaluation.period_label??"Période libre"}${evaluation.strengths?` · ${evaluation.strengths}`:""}${evaluation.improvements?` · ${evaluation.improvements}`:""}`,to:"/evaluations"})}
 for(const objective of objectives.data??[]){const evaluation=(evaluations.data??[]).find(e=>e.id===objective.evaluation_id);if(!evaluation||evaluation.status!=="validated")continue;const isOwn=!!member?.id&&objective.subject_member_id===member.id;if(!isStaff&&!isOwn)continue;const person=memberById.get(objective.subject_member_id);out.push({id:`objective-${objective.id}`,kind:"objective",title:objective.label,detail:`${person?.full_name??"Membre"} · ${objective.status}${objective.due_date?` · échéance ${formatDate(objective.due_date)}`:""}`,to:"/evaluations"})}
 if(isStaff)for(const d of debriefs.data??[]){const program=programById.get(d.program_id);out.push({id:`debrief-${d.id}`,kind:"debrief",title:`Post-service${program?` — ${program.title}`:""}`,detail:[d.summary,d.went_well,d.to_improve,d.incident_detail].filter(Boolean).join(" · ")||"Débrief de programme",to:"/post-service"})}
 for(const x of material.data?.items??[]){const pole=poleById.get(x.primary_pole_id as any);out.push({id:`material-${x.id}`,kind:"material",title:x.name,detail:[x.category,x.brand,x.model,x.state,x.location,pole?.name,x.notes].filter(Boolean).join(" · "),to:"/materiel-com"})}
 for(const n of material.data?.needs??[]){const pole=poleById.get(n.pole_id as any);out.push({id:`material-need-${n.id}`,kind:"material_need",title:n.title,detail:[pole?.name,n.priority,n.status,n.description,n.justification,n.alternative].filter(Boolean).join(" · "),to:"/materiel-com"})}
 for(const r of material.data?.requests??[])out.push({id:`material-request-${r.id}`,kind:"material_request",title:r.title,detail:[r.status,r.church_reference,r.notes].filter(Boolean).join(" · "),to:"/materiel-com"});
 for(const i of material.data?.incidents??[]){const item:any=itemById.get(i.item_id);out.push({id:`material-incident-${i.id}`,kind:"material_incident",title:i.title,detail:[item?.name,i.severity,i.status,i.description].filter(Boolean).join(" · "),to:"/materiel-com"})}
 return out.filter(hit=>normalize(`${hit.title} ${hit.detail}`).includes(q)).slice(0,100)},[term,members.data,programs.data,solicitations.data,poles.data,tasks.data,training.data,evaluations.data,objectives.data,debriefs.data,material.data,member?.id,isStaff]);
 return <AppShell title="Recherche" subtitle="Membres, programmes, tâches, formations, évaluations, post-services et Matériel COM"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input autoFocus value={term} onChange={e=>setTerm(e.target.value)} placeholder="Rechercher un nom, un programme, un matériel, un devis…" className="pl-9"/></div><div className="mt-5 space-y-2">{term.trim().length<2?<EmptyState title="Saisis au moins deux caractères"/>:hits.length===0?<EmptyState title="Aucun résultat" description={`Rien ne correspond à « ${term} ».`}/>:hits.map(hit=><Link key={hit.id} to={hit.to as any}><Card className="transition-colors hover:border-icc-violet/50"><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4"><div><p className="font-bold">{hit.title}</p><p className="text-xs text-muted-foreground">{hit.detail}</p></div><Badge variant="secondary">{KIND_LABEL[hit.kind]??hit.kind}</Badge></CardContent></Card></Link>)}</div></AppShell>}
