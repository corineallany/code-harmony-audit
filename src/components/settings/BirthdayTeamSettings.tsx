import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cake } from "lucide-react";
import { toast } from "sonner";

import { settingsQuery } from "@/lib/icc";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function BirthdayTeamSettings(){
  const qc=useQueryClient(); const settings=useQuery(settingsQuery); const [allowed,setAllowed]=useState(false);
  useEffect(()=>{setAllowed(Boolean((settings.data as any)?.birthday_hide_allowed))},[settings.data]);
  const save=useMutation({mutationFn:async(value:boolean)=>{const{error}=await (supabase as any).from("app_settings").update({birthday_hide_allowed:value,updated_at:new Date().toISOString()}).eq("id","main");if(error)throw error},onSuccess:(_,value)=>{setAllowed(value);qc.invalidateQueries({queryKey:["app-settings"]});toast.success(value?"Les membres peuvent maintenant masquer leur anniversaire":"Les anniversaires restent visibles à toute l’équipe")},onError:(e:any)=>toast.error("Modification impossible",{description:e.message})});
  return <Card><CardHeader><div className="flex items-center gap-2"><Cake className="size-5 text-icc-violet"/><CardTitle>Vie d’équipe · Anniversaires</CardTitle></div><CardDescription>Par défaut, les anniversaires renseignés sont visibles à l’équipe afin de pouvoir célébrer les personnes. L’âge et l’année de naissance ne sont jamais affichés.</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between gap-5 rounded-xl border p-4"><div><p className="font-semibold">Autoriser les membres à masquer leur anniversaire</p><p className="mt-1 text-sm text-muted-foreground">Désactivé : personne ne peut se masquer. Activé : chacun peut choisir depuis « Mon profil ».</p></div><Switch checked={allowed} disabled={save.isPending} onCheckedChange={(value)=>save.mutate(value)}/></div></CardContent></Card>
}
