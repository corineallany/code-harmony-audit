import { createFileRoute } from "@tanstack/react-router";
import { Eye, FilePlus2, Users, CalendarDays, Paperclip, Archive, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { AdminProgrammes } from "@/components/admin/AdminProgrammes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/administration")({
  validateSearch: (search: Record<string, unknown>) => ({ newProgram: search.newProgram === "1" ? "1" : undefined }),
  component: Administration,
});

function Administration() {
  const { isAdmin, loading } = useCurrentRole();
  const { newProgram } = Route.useSearch();
  if (loading) return <AppShell title="Administration des programmes"><p className="text-sm text-muted-foreground">Chargement…</p></AppShell>;
  if (isAdmin) return <AppShell title="Administration des programmes" subtitle="Créer, modifier et archiver les programmes"><AdminProgrammes openNewOnMount={newProgram === "1"} /></AppShell>;

  return <AppShell title="Administration des programmes" subtitle="Aperçu complet de la création et de la gestion des programmes">
    <div className="space-y-5">
      <Card className="border-violet-200 bg-violet-50"><CardContent className="flex gap-3 p-4"><Eye className="mt-0.5 size-5 text-icc-violet"/><div><b>Mode consultation</b><p className="text-sm text-muted-foreground">Vous pouvez voir le véritable contenu de l’administration des programmes et comprendre toutes les informations qui peuvent être renseignées. La création, la modification, l’affectation et l’archivage restent réservés aux profils habilités.</p></div></CardContent></Card>

      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-icc-violet">Programmes actifs</h3><p className="text-sm text-muted-foreground">Un administrateur retrouve ici les programmes existants avec les actions Modifier et Archiver.</p></div><Button disabled><FilePlus2 className="size-4"/>Nouveau programme</Button></div>
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b>Exemple de programme</b><p className="text-xs text-muted-foreground">Date, limite de réponse et état du programme apparaissent ici.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled>Modifier</Button><Button size="sm" variant="outline" disabled><Archive className="size-4"/>Archiver</Button></div></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 className="size-5"/>Fiche « Nouveau programme »</CardTitle></CardHeader><CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PreviewField label="Titre"/><PreviewField label="Statut" value="Non confirmé"/><PreviewField label="Type" value="Église / Corporate / Invitation / Interne COM"/><PreviewField label="Format" value="Présentiel / En ligne / Déplacement…"/></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><PreviewField label="Date début"/><PreviewField label="Heure début"/><PreviewField label="Date fin"/><PreviewField label="Heure fin"/><PreviewField label="Date limite de réponse"/></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PreviewField label="Lieu"/><PreviewField label="Récurrence" value="Ponctuel / Hebdomadaire / Mensuel…"/><PreviewField label="Public / groupe" value="ICC / EJP / Toute l’église"/><PreviewField label="Lien / ressource"/></div>
        <section className="rounded-xl border p-4"><h4 className="font-bold">Description, contexte et note générale</h4><p className="mt-1 text-sm text-muted-foreground">Le responsable peut préciser le contexte, les consignes générales et les informations nécessaires à l’équipe.</p><Input className="mt-3" disabled placeholder="Zone de texte du programme"/></section>
        <section className="rounded-xl border p-4"><h4 className="flex items-center gap-2 font-bold"><Paperclip className="size-4"/>Fichiers du programme</h4><p className="mt-1 text-sm text-muted-foreground">Photos, PDF, Word, Excel et autres documents utiles peuvent être joints au programme.</p><Button className="mt-3" variant="outline" disabled>Ajouter des fichiers</Button></section>
        <section className="rounded-xl border p-4"><h4 className="flex items-center gap-2 font-bold"><Users className="size-4"/>Pôles et membres mobilisés</h4><p className="mt-1 text-sm text-muted-foreground">Chaque pôle peut être activé, recevoir une mission et des membres. Les indisponibilités et doubles affectations sont signalées comme conflits sans empêcher automatiquement l’affectation.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><PreviewPole name="Photo"/><PreviewPole name="Vidéo"/><PreviewPole name="Son"/><PreviewPole name="Communication"/></div></section>
        <section className="rounded-xl border p-4"><h4 className="flex items-center gap-2 font-bold"><CalendarDays className="size-4"/>Réponses et échéances</h4><p className="mt-1 text-sm text-muted-foreground">La date limite de réponse sert de référence pour les sollicitations, relances et suivis liés au programme.</p></section>
        <div className="flex justify-end"><Button disabled><ShieldCheck className="size-4"/>Enregistrer le programme — action réservée</Button></div>
      </Card></Card>
    </div>
  </AppShell>;
}
function PreviewField({label,value}:{label:string;value?:string}){return <div className="space-y-1"><p className="text-xs font-semibold">{label}</p><div className="min-h-10 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{value||"Champ disponible"}</div></div>}
function PreviewPole({name}:{name:string}){return <div className="rounded-lg border bg-muted/20 p-3"><div className="flex items-center justify-between"><b>{name}</b><Badge variant="outline">Pôle</Badge></div><p className="mt-2 text-xs text-muted-foreground">Mission · besoin humain · sélection des membres · état de disponibilité · conflit éventuel</p></div>}
