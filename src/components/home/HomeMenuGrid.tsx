import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentRole } from "@/hooks/useAuth";
import { settingsQuery } from "@/lib/icc";
import { normalizeMenuModules } from "@/components/settings/MenuModulesPanel";
import { cn } from "@/lib/utils";

type Item={key:string;icon:string;title:string;desc:string;to:string;tone?:"default"|"violet"|"dark";staffOnly?:boolean;adminOnly?:boolean};
const ITEMS:Item[]=[
 {key:"planning",icon:"📅",title:"Planning",desc:"Calendrier général et liste chronologique.",to:"/planning"},
 {key:"programmes",icon:"☑️",title:"Programmes",desc:"Statuts, dates, pôles et personnes mobilisées.",to:"/programmes"},
 {key:"trombinoscope",icon:"👥",title:"Trombinoscope",desc:"Membres, rôles, pôles et intégration.",to:"/trombinoscope"},
 {key:"formations",icon:"🎓",title:"Formations",desc:"Parcours par pôle, progression et validations.",to:"/formations"},
 {key:"sollicitations",icon:"🤝",title:"Sollicitations ponctuelles",desc:"Renfort, ajout ou remplacement ponctuel.",to:"/sollicitations",staffOnly:true},
 {key:"poles",icon:"🗂️",title:"Pôles",desc:"Référents et organisation des pôles.",to:"/poles"},
 {key:"materiel_com",icon:"📦",title:"Matériel COM",desc:"Inventaire, état du parc, besoins, devis, acquisitions et suivi.",to:"/materiel-com"},
 {key:"pilotage",icon:"📊",title:"Pilotage",desc:"Suivi, priorités et indicateurs.",to:"/pilotage",staffOnly:true},
 {key:"disponibilites",icon:"🕒",title:"Disponibilités",desc:"Indisponibilités, affectations, réponses et conflits.",to:"/disponibilites"},
 {key:"taches",icon:"📋",title:"Tâches",desc:"Étapes, priorités et préparation des programmes.",to:"/taches"},
 {key:"modeles",icon:"🧩",title:"Modèles de programme",desc:"Modèles réutilisables avec pôles et checklist.",to:"/modeles",staffOnly:true},
 {key:"post_service",icon:"📝",title:"Post-service",desc:"Compte rendu après chaque programme réalisé.",to:"/post-service"},
 {key:"evaluations",icon:"⭐",title:"Évaluations",desc:"Évaluations opérationnelles, référents et leadership.",to:"/evaluations"},
 {key:"recherche",icon:"🔎",title:"Recherche",desc:"Recherche universelle dans toutes les données.",to:"/recherche"},
 {key:"historique",icon:"🕰️",title:"Historique",desc:"Journal des actions et traçabilité.",to:"/historique",staffOnly:true},
 {key:"archives",icon:"🗄️",title:"Archives & corbeille",desc:"Éléments archivés, restauration et suppression.",to:"/archives",staffOnly:true},
 {key:"exports",icon:"📤",title:"Exports",desc:"Exports Excel des membres, programmes et sollicitations.",to:"/exports",staffOnly:true},
 {key:"nouveau_programme",icon:"＋",title:"Administration / Nouveau programme",desc:"Créer et affecter un nouveau programme.",to:"/administration",tone:"violet",adminOnly:true},
 {key:"parametres",icon:"⚙️",title:"Paramètres",desc:"Structure, droits et configuration.",to:"/parametres",tone:"dark",staffOnly:true},
];
export function HomeMenuGrid(){const{isStaff,isAdmin}=useCurrentRole();const settings=useQuery(settingsQuery);const config=normalizeMenuModules((settings.data as any)?.menus);const byKey=new Map(config.map(x=>[x.key,x]));const items=ITEMS.map(item=>{const c=byKey.get(item.key);return {...item,title:c?.label||item.title,_enabled:c?.enabled!==false,_visible:c?.menuVisible!==false,_order:c?.order??999}}).filter(i=>i._enabled&&i._visible).sort((a,b)=>a._order-b._order);return <><div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 text-sm"><b className="text-icc-violet">Tous les modules sont visibles et visitables par tous.</b><p className="mt-1 text-muted-foreground">Lorsqu’un droit manque, le vrai module s’ouvre quand même en consultation. Les écrans, rubriques, boutons et possibilités restent visibles ; les données sensibles sont masquées et les actions non autorisées sont désactivées ou refusées.</p></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map(item=>{const restricted=(item.adminOnly&&!isAdmin)||(item.staffOnly&&!isStaff);return <Link key={item.key} to={item.to as any} className={cn("icc-menu-card block",item.tone==="violet"&&"bg-icc-violet text-white hover:bg-icc-violet-hover",item.tone==="dark"&&"border-slate-800 bg-slate-800 text-white hover:bg-slate-900")}><div className="flex items-start justify-between gap-2"><span className={cn("text-2xl",item.tone?"text-icc-yellow":"text-icc-violet")}>{item.icon}</span>{restricted?<span className={cn("rounded-full px-2 py-1 text-[10px] font-bold",item.tone?"bg-white/15 text-white":"bg-muted text-muted-foreground")}>Consultation</span>:null}</div><h3 className="mt-2.5 font-black">{item.title}</h3><p className={cn("mt-1 text-xs",item.tone?"text-white/70":"text-muted-foreground")}>{item.desc}</p></Link>})}</div></>}
