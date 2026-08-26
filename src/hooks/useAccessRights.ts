import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { membersQuery, settingsQuery } from "@/lib/icc";
import { useCurrentRole } from "@/hooks/useAuth";

export type AccessScope="interdit"|"moi"|"mon_pole"|"tous";
export function useAccessRights(){
 const current=useCurrentRole(); const members=useQuery(membersQuery); const settings=useQuery(settingsQuery);
 const perms=useQuery({queryKey:["access-role-permissions-runtime"],queryFn:async()=>{const{data,error}=await (supabase as any).from("access_role_permissions").select("role_key,module_key,action_key,scope,enabled");if(error)throw error;return data??[]}});
 const exceptions=useQuery({queryKey:["access-user-exceptions-runtime",current.member?.id],enabled:!!current.member?.id,queryFn:async()=>{const{data,error}=await (supabase as any).from("access_user_exceptions").select("member_id,module_key,action_key,scope,enabled").eq("member_id",current.member!.id);if(error)throw error;return data??[]}});
 const memberId=current.member?.id; const s:any=settings.data; const isDirection=!!memberId&&(s?.supervisor_member_id===memberId||s?.adjoint_member_id===memberId||s?.group_leads?.communication===memberId||s?.group_leads?.audiovisuel===memberId); const isReferent=!!memberId&&(members.data?.links??[]).some(l=>l.member_id===memberId&&l.is_referent); const roleKey=isDirection?"direction":isReferent?"referent":"equipier";
 const scope=(moduleKey:string,actionKey:string):AccessScope=>{const ex=(exceptions.data??[]).find((x:any)=>x.module_key===moduleKey&&x.action_key===actionKey);if(ex)return ex.enabled===false?"interdit":(ex.scope??"interdit");const row=(perms.data??[]).find((x:any)=>x.role_key===roleKey&&x.module_key===moduleKey&&x.action_key===actionKey);return row?.enabled===false?"interdit":(row?.scope??"interdit")};
 const inPole=(poleId:string)=>!!memberId&&(members.data?.links??[]).some(l=>l.member_id===memberId&&l.pole_id===poleId);
 const allowed=(moduleKey:string,actionKey:string,poleId?:string)=>{const x=scope(moduleKey,actionKey);if(x==="tous")return true;if(x==="mon_pole"&&poleId)return inPole(poleId);if(x==="moi")return false;return false};
 return{loading:current.loading||members.isLoading||settings.isLoading||perms.isLoading||exceptions.isLoading,memberId,roleKey,scope,allowed,inPole};
}
