import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { solicitationsQuery } from "@/lib/icc";

type Assignment={id:string;pole_id:string;memberIds:string[];required_count?:number|null};
export function ProgramStaffingSummary({programId,assignments,poleName,isStaff=false}:{programId:string;assignments:Assignment[];poleName:Map<string,string>;isStaff?:boolean}){
 const solicitations=useQuery(solicitationsQuery);
 const needs=useQuery({queryKey:["program-staffing",programId],queryFn:async()=>{const{data,error}=await (supabase as any).from("program_assignments").select("id,required_count").eq("program_id",programId);if(error)throw error;return data??[]}});
 const req=new Map((needs.data??[]).map((x:any)=>[x.id,Number(x.required_count??0)]));
 const open=(solicitations.data??[]).filter((s:any)=>s.program_id===programId&&!s.archived&&s.status!=="cancelled"&&s.status!=="done");
 return <Card><CardHeader><CardTitle>Besoins humains & couverture</CardTitle></CardHeader><CardContent className="space-y-3">
  <p className="text-sm text-muted-foreground">Le programme définit le besoin. Les sollicitations servent à trouver les personnes manquantes ; seules les personnes réellement retenues comptent comme affectées.</p>
  {assignments.length===0?<p className="text-sm">Aucun pôle mobilisé.</p>:assignments.map(a=>{const required=req.get(a.id)??0,assigned=a.memberIds.length,remaining=Math.max(0,required-assigned);return <div key={a.id} className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b>{poleName.get(a.pole_id)??"Pôle"}</b><Badge variant={required>0&&remaining>0?"destructive":"secondary"}>{required>0?`${assigned}/${required} affecté${assigned>1?"s":""}`:`${assigned} affecté${assigned>1?"s":""}`}</Badge></div>{required>0?<p className="mt-1 text-sm">{remaining?`⚠️ ${remaining} place${remaining>1?"s":""} restante${remaining>1?"s":""} à couvrir`:`✅ Besoin couvert`}</p>:<p className="mt-1 text-sm text-muted-foreground">Besoin chiffré non renseigné</p>}{isStaff&&remaining>0?<div className="mt-2 flex gap-2"><Button asChild size="sm"><Link to="/sollicitations">Rechercher {remaining} renfort{remaining>1?"s":""}</Link></Button></div>:null}</div>})}
  {open.length?<div className="rounded-xl bg-muted/50 p-3"><b>📣 {open.length} sollicitation{open.length>1?"s":""} liée{open.length>1?"s":""} à ce programme</b><p className="text-sm text-muted-foreground">Renforts et remplacements restent visibles et pilotables dans Sollicitations ponctuelles.</p><Button asChild variant="outline" size="sm" className="mt-2"><Link to="/sollicitations">Voir les sollicitations</Link></Button></div>:null}
 </CardContent></Card>
}
