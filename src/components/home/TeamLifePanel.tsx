import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cake, Wallet } from "lucide-react";

import { membersQuery, settingsQuery } from "@/lib/icc";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

function nextBirthday(day:number,month:number){const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());let next=new Date(now.getFullYear(),month-1,day);if(next<today)next=new Date(now.getFullYear()+1,month-1,day);return next}
function daysUntil(date:Date){const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((date.getTime()-today.getTime())/86400000)}
function whenLabel(date:Date){const d=daysUntil(date);if(d===0)return"Aujourd’hui";if(d===1)return"Demain";if(d<7)return`Dans ${d} jours`;return date.toLocaleDateString("fr-FR",{day:"2-digit",month:"long"})}
const euro=(v:number)=>Number(v??0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});

export function TeamLifePanel(){
 const members=useQuery(membersQuery),settings=useQuery(settingsQuery);
 const finance=useQuery({queryKey:["team-finance-summary"],queryFn:async()=>{const{data,error}=await (supabase as any).rpc("team_finance_public_summary");if(error)throw error;return data as any},retry:false});
 const hideAllowed=Boolean((settings.data as any)?.birthday_hide_allowed);
 const birthdays=(members.data?.members??[]).filter((m:any)=>m.status==="active"&&m.birthday_day&&m.birthday_month&&(!hideAllowed||!m.birthday_hidden)).map((m:any)=>({...m,nextBirthday:nextBirthday(m.birthday_day,m.birthday_month)})).filter((m:any)=>daysUntil(m.nextBirthday)<=30).sort((a:any,b:any)=>a.nextBirthday.getTime()-b.nextBirthday.getTime());
 return <section className="mt-6 rounded-3xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Cake className="size-5 text-icc-violet"/><h2 className="font-black text-icc-violet">Vie d’équipe</h2></div><p className="mt-1 text-xs text-muted-foreground">Anniversaires, caisse fraternelle et bientôt communions fraternelles, propositions et sondages.</p></div><Link to="/trombinoscope" className="text-xs font-bold text-icc-violet">Voir l’équipe →</Link></div>
 <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card className="border-dashed"><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">🎂 Anniversaires à venir</h3><p className="text-xs text-muted-foreground">30 prochains jours · sans âge ni année de naissance.</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">{birthdays.length}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{birthdays.length?birthdays.slice(0,6).map((m:any)=><Link key={m.id} to="/membre/$id" params={{id:m.id}} className="rounded-xl bg-muted/40 p-3 hover:bg-muted"><b className="text-sm">{m.full_name}</b><p className="mt-1 text-xs text-muted-foreground">{whenLabel(m.nextBirthday)}</p></Link>):<p className="col-span-full rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">Aucun anniversaire renseigné dans les 30 prochains jours.</p>}</div></CardContent></Card>
 <Card className="border-dashed"><CardContent className="p-4"><div className="flex items-center gap-2"><Wallet className="size-5 text-icc-violet"/><h3 className="font-bold">💶 Caisse fraternelle</h3></div>{finance.data?<><b className="mt-3 block text-2xl text-icc-violet">{euro(finance.data.balance)}</b><p className="text-xs text-muted-foreground">Solde collectif réel · basé uniquement sur les écritures confirmées.</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-muted/40 p-2"><b>{euro(finance.data.monthIncome)}</b><span className="block text-muted-foreground">Entrées ce mois</span></div><div className="rounded-lg bg-muted/40 p-2"><b>{euro(finance.data.monthExpenses)}</b><span className="block text-muted-foreground">Dépenses ce mois</span></div></div></>:<p className="mt-3 text-xs text-muted-foreground">La caisse sera disponible selon les droits attribués.</p>}<Link to="/caisse-fraternelle" className="mt-4 inline-block text-xs font-bold text-icc-violet">Ouvrir la caisse fraternelle →</Link></CardContent></Card></div>
 </section>
}
