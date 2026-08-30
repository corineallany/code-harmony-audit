import { useEffect, useState, useCallback } from "react";
import { getVapidPublicKey, subscribePush, unsubscribePush } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String:string):ArrayBuffer{const padding="=".repeat((4-(base64String.length%4))%4);const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");const rawData=atob(base64);const out=new Uint8Array(rawData.length);for(let i=0;i<rawData.length;i++)out[i]=rawData.charCodeAt(i);return out.buffer.slice(0,out.byteLength) as ArrayBuffer}
export type PushState="unsupported"|"loading"|"default"|"granted"|"denied";
const swUrl=()=>`${import.meta.env.BASE_URL || "/"}sw.js`;

export function usePush(userId:string|undefined){
 const[state,setState]=useState<PushState>("loading"),[subscribed,setSubscribed]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(!userId)return;if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setState("unsupported");return}
  async function init(){try{await navigator.serviceWorker.register(swUrl());const reg=await navigator.serviceWorker.ready;const perm=Notification.permission;setState(perm==="granted"?"granted":perm==="denied"?"denied":"default");setSubscribed(!!(await reg.pushManager.getSubscription()))}catch(err){setState("default");setError(err instanceof Error?err.message:"Impossible d’initialiser les notifications push.")}}
  init();
 },[userId]);
 const enable=useCallback(async()=>{if(!userId)return;setError(null);setState("loading");try{
  if(!window.matchMedia("(display-mode: standalone)").matches && /iPhone|iPad|iPod/i.test(navigator.userAgent)){setState("default");setError("Sur iPhone, les notifications push fonctionnent depuis l’app installée sur l’écran d’accueil. Ouvrez COM ICC depuis son icône, puis réessayez.");return}
  const registration=await navigator.serviceWorker.register(swUrl());await navigator.serviceWorker.ready;
  const perm=await Notification.requestPermission();if(perm!=="granted"){setState(perm==="denied"?"denied":"default");setError("Les notifications n’ont pas été autorisées. Sur iPhone, vérifiez Réglages > Notifications > COM ICC.");return}setState("granted");
  const existing=await registration.pushManager.getSubscription();if(existing){await subscribePush({data:{endpoint:existing.endpoint,p256dh:existing.toJSON().keys?.["p256dh"]??"",auth:existing.toJSON().keys?.["auth"]??"",userAgent:navigator.userAgent}});setSubscribed(true);return}
  const{publicKey}=await getVapidPublicKey();if(!publicKey)throw new Error("La clé Push publique n’est pas configurée.");const sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(publicKey)});const json=sub.toJSON(),keys=json.keys;if(!keys)throw new Error("Clés d’abonnement Push manquantes.");await subscribePush({data:{endpoint:sub.endpoint,p256dh:keys["p256dh"],auth:keys["auth"],userAgent:navigator.userAgent}});setSubscribed(true);
 }catch(err){setState(Notification.permission==="denied"?"denied":"default");setError(err instanceof Error?err.message:"Erreur lors de l’activation des notifications.")}},[userId]);
 const disable=useCallback(async()=>{if(!userId)return;setError(null);try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await unsubscribePush({data:{endpoint:sub.endpoint}});await sub.unsubscribe()}setSubscribed(false)}catch(err){setError(err instanceof Error?err.message:"Erreur lors de la désactivation")}},[userId]);
 return{state,subscribed,error,enable,disable};
}