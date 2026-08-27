import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cake } from "lucide-react";

import { membersQuery, settingsQuery } from "@/lib/icc";
import { Card, CardContent } from "@/components/ui/card";

function nextBirthday(day:number,month:number){
  const now=new Date(); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let next=new Date(now.getFullYear(),month-1,day);
  if(next<today)next=new Date(now.getFullYear()+1,month-1,day);
  return next;
}
function daysUntil(date:Date){const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((date.getTime()-today.getTime())/86400000)}
function whenLabel(date:Date){const d=daysUntil(date);if(d===0)return"Aujourd’hui";if(d===1)return"Demain";if(d<7)return`Dans ${d} jours`;return date.toLocaleDateString("fr-FR",{day:"2-digit",month:"long"})}

export function TeamLifePanel(){
  const members=useQuery(membersQuery); const settings=useQuery(settingsQuery);
  const hideAllowed=Boolean((settings.data as any)?.birthday_hide_allowed);
  const birthdays=(members.data?.members??[])
    .filter((m:any)=>m.status==="active"&&m.birthday_day&&m.birthday_month&&(!hideAllowed||!m.birthday_hidden))
    .map((m:any)=>({...m,nextBirthday:nextBirthday(m.birthday_day,m.birthday_month)}))
    .filter((m:any)=>daysUntil(m.nextBirthday)<=30)
    .sort((a:any,b:any)=>a.nextBirthday.getTime()-b.nextBirthday.getTime());

  return <section className="mt-6 rounded-3xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2"><Cake className="size-5 text-icc-violet"/><h2 className="font-black text-icc-violet">Vie d’équipe</h2></div><p className="mt-1 text-xs text-muted-foreground">Les moments qui font vivre l’équipe en dehors du pilotage opérationnel.</p></div>
      <Link to="/trombinoscope" className="text-xs font-bold text-icc-violet">Voir l’équipe →</Link>
    </div>
    <Card className="mt-4 border-dashed"><CardContent className="p-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">🎂 Anniversaires à venir</h3><p className="text-xs text-muted-foreground">30 prochains jours · sans âge ni année de naissance.</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">{birthdays.length}</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {birthdays.length?birthdays.slice(0,6).map((m:any)=><Link key={m.id} to="/membre/$id" params={{id:m.id}} className="rounded-xl bg-muted/40 p-3 transition-colors hover:bg-muted"><b className="text-sm">{m.full_name}</b><p className="mt-1 text-xs text-muted-foreground">{whenLabel(m.nextBirthday)}</p></Link>):<p className="col-span-full rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">Aucun anniversaire renseigné dans les 30 prochains jours.</p>}
      </div>
    </CardContent></Card>
  </section>
}
