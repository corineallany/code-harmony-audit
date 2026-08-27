import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cake } from "lucide-react";

import { useCurrentRole } from "@/hooks/useAuth";
import { settingsQuery } from "@/lib/icc";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function MyBirthdayPrivacy(){
  const{member}=useCurrentRole();const settings=useQuery(settingsQuery);const qc=useQueryClient();
  const allowed=Boolean((settings.data as any)?.birthday_hide_allowed);
  const mutation=useMutation({mutationFn:async(value:boolean)=>{const{error}=await (supabase as any).rpc("set_my_birthday_hidden",{p_hidden:value});if(error)throw error},onSuccess:()=>{qc.invalidateQueries({queryKey:["members"]});toast.success("Préférence anniversaire enregistrée")},onError:(e:any)=>toast.error("Modification impossible",{description:e.message})});
  if(!allowed)return null;
  return <Card className="mt-4"><CardHeader><div className="flex items-center gap-2"><Cake className="size-5 text-icc-violet"/><CardTitle className="text-base">Anniversaire & vie d’équipe</CardTitle></div><CardDescription>La Direction autorise le choix individuel. Masquer retire uniquement votre anniversaire des espaces collectifs ; la date reste dans votre fiche administrative.</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><p className="font-semibold">Masquer mon anniversaire à l’équipe</p><p className="text-xs text-muted-foreground">Votre âge et votre année de naissance ne sont jamais affichés.</p></div><Switch checked={Boolean((member as any)?.birthday_hidden)} disabled={mutation.isPending} onCheckedChange={(v)=>mutation.mutate(v)}/></div></CardContent></Card>
}
