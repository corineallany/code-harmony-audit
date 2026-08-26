import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Home, Save, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { membersQuery, polesQuery, settingsQuery } from "@/lib/icc";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — COM ICC Le Mans" }] }),
  component: Parametres,
});

type Verse = { ref: string; text: string };
type DirectionStructure = "responsable_adjoint" | "responsable_general_grands_groupes";

const DEFAULT_VERSES: Verse[] = [
  { ref: "Matthieu 6:33", text: "« Cherchez premièrement le royaume et la justice de Dieu; et toutes ces choses vous seront données par-dessus. »" },
  { ref: "Hébreux 6:10", text: "« Car Dieu n’est pas injuste, pour oublier votre travail et l’amour que vous avez montré pour son nom, ayant rendu et rendant encore des services aux saints. »" },
];

function Parametres() {
  const queryClient = useQueryClient();
  const settings = useQuery(settingsQuery);
  const members = useQuery(membersQuery);
  const poles = useQuery(polesQuery);
  const rawSettings = settings.data as any;

  const [homeTitle, setHomeTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverEnabled, setCoverEnabled] = useState(true);
  const [verses, setVerses] = useState<Verse[]>(DEFAULT_VERSES);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setHomeTitle(s.home_title ?? "COM ICC Le Mans");
    setBrand(s.brand ?? "LE MANS");
    setSubtitle(s.subtitle ?? "Communication • Organisation • Service");
    setIconUrl(s.icon_url ?? "");
    setCoverUrl(s.cover_url ?? "");
    setCoverEnabled(s.cover_enabled ?? true);
    const stored = Array.isArray(s.verses) ? (s.verses as unknown as Verse[]) : [];
    setVerses([0, 1].map((i) => ({ ref: stored[i]?.ref ?? DEFAULT_VERSES[i].ref, text: stored[i]?.text ?? DEFAULT_VERSES[i].text })));
  }, [settings.data]);

  const activeMembers = useMemo(() => (members.data?.members ?? []).filter((m) => m.status === "active"), [members.data]);
  const activePoles = useMemo(() => (poles.data ?? []).filter((p) => !p.archived), [poles.data]);
  const directionStructure: DirectionStructure = rawSettings?.direction_structure ?? "responsable_adjoint";

  const saveIdentity = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").upsert({
        id: "main", home_title: homeTitle.trim() || "COM ICC Le Mans", brand: brand.trim() || "LE MANS",
        subtitle: subtitle.trim() || null, icon_url: iconUrl.trim() || null, cover_url: coverUrl.trim() || null,
        cover_enabled: coverEnabled, verses, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["app-settings"] }); toast.success("Identité et accueil enregistrés"); },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const saveDirection = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("app_settings").update({ ...patch, updated_at: new Date().toISOString() } as any).eq("id", "main");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["app-settings"] }); toast.success("Organisation mise à jour"); },
    onError: (e: Error) => toast.error("Modification impossible", { description: e.message }),
  });

  const changeStructure = (value: DirectionStructure) => {
    saveDirection.mutate(value === "responsable_adjoint"
      ? { direction_structure: value, grands_groupes_member_id: null }
      : { direction_structure: value, adjoint_member_id: null });
  };

  const saveReferent = useMutation({
    mutationFn: async ({ poleId, memberId }: { poleId: string; memberId: string | null }) => {
      const poleLinks = (members.data?.links ?? []).filter((l) => l.pole_id === poleId);
      const currentReferents = poleLinks.filter((l) => l.is_referent);
      if (currentReferents.length) {
        const { error } = await supabase.from("member_poles").update({ is_referent: false }).in("id", currentReferents.map((l) => l.id));
        if (error) throw new Error(error.message);
      }
      if (!memberId) return;
      const existing = poleLinks.find((l) => l.member_id === memberId);
      if (existing) {
        const { error } = await supabase.from("member_poles").update({ is_referent: true }).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("member_poles").insert({ member_id: memberId, pole_id: poleId, is_referent: true });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["members"] }); toast.success("Référent du pôle mis à jour"); },
    onError: (e: Error) => toast.error("Modification impossible", { description: e.message }),
  });

  const memberSelect = (label: string, value: string, field: string) => (
    <Field label={label}>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => saveDirection.mutate({ [field]: e.target.value || null })}>
        <option value="">Non défini</option>
        {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
      </select>
    </Field>
  );

  return (
    <AppShell title="Paramètres" subtitle="Configuration générale de l’espace COM ICC Le Mans">
      <Tabs defaultValue="identite" className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/70 p-1.5">
          <TabsTrigger value="identite" className="gap-2"><Home className="size-4" />Identité & accueil</TabsTrigger>
          <TabsTrigger value="organisation" className="gap-2"><Users className="size-4" />Organisation</TabsTrigger>
          <TabsTrigger value="droits" className="gap-2"><ShieldCheck className="size-4" />Accès & droits</TabsTrigger>
          <TabsTrigger value="menus" className="gap-2"><SlidersHorizontal className="size-4" />Menus & modules</TabsTrigger>
          <TabsTrigger value="technique" className="gap-2"><Building2 className="size-4" />Administration technique</TabsTrigger>
        </TabsList>

        <TabsContent value="identite" className="space-y-4">
          <Card><CardHeader><CardTitle>Identité de l’espace</CardTitle><CardDescription>Ces informations alimentent l’en-tête et l’accueil. Une seule source : Supabase.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Nom de l’application"><Input value={homeTitle} onChange={(e) => setHomeTitle(e.target.value)} /></Field>
              <Field label="Marque / localisation"><Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="LE MANS" /></Field>
              <Field label="Sous-titre"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
              <Field label="Logo / icône (URL)"><Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://…" /></Field>
            </CardContent></Card>
          <Card><CardHeader><CardTitle>Accueil</CardTitle><CardDescription>Couverture et deux versets affichés sur la page d’accueil.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-semibold">Afficher la couverture</p><p className="text-sm text-muted-foreground">Active ou masque le visuel de couverture lorsqu’il est configuré.</p></div><Switch checked={coverEnabled} onCheckedChange={setCoverEnabled} /></div>
              <Field label="Image de couverture (URL)"><Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" /></Field>
              <div className="grid gap-4 lg:grid-cols-2">{verses.map((verse, index) => <div key={index} className="space-y-3 rounded-xl border p-4"><p className="font-bold text-icc-violet">Verset {index + 1}</p><Field label="Référence"><Input value={verse.ref} onChange={(e) => setVerses((v) => v.map((x, i) => i === index ? { ...x, ref: e.target.value } : x))} /></Field><Field label="Texte"><Textarea rows={4} value={verse.text} onChange={(e) => setVerses((v) => v.map((x, i) => i === index ? { ...x, text: e.target.value } : x))} /></Field></div>)}</div>
              <Button onClick={() => saveIdentity.mutate()} disabled={saveIdentity.isPending}><Save className="size-4" />{saveIdentity.isPending ? "Enregistrement…" : "Enregistrer Identité & accueil"}</Button>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="organisation" className="space-y-4">
          <Card><CardHeader><CardTitle>Direction</CardTitle><CardDescription>Choisissez la structure de direction utilisée par la COM. Les fonctions affichées dans l’application découlent de cette configuration et restent distinctes des droits techniques.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <Field label="Structure de direction">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={directionStructure} onChange={(e) => changeStructure(e.target.value as DirectionStructure)}>
                  <option value="responsable_adjoint">Responsable + Adjoint + Référents</option>
                  <option value="responsable_general_grands_groupes">Responsable général + Responsable Grands Groupes + Référents</option>
                </select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                {memberSelect(directionStructure === "responsable_adjoint" ? "Responsable" : "Responsable général", rawSettings?.supervisor_member_id ?? "", "supervisor_member_id")}
                {directionStructure === "responsable_adjoint"
                  ? memberSelect("Adjoint", rawSettings?.adjoint_member_id ?? "", "adjoint_member_id")
                  : memberSelect("Responsable Grands Groupes", rawSettings?.grands_groupes_member_id ?? "", "grands_groupes_member_id")}
              </div>
              <p className="text-sm text-muted-foreground">Les fonctions de direction sont pilotées ici et ne sont pas des rôles fixes du trombinoscope. Le statut Admin technique reste un droit séparé.</p>
            </CardContent></Card>

          <Card><CardHeader><CardTitle>Référents par pôle</CardTitle><CardDescription>Une même personne peut être référente de plusieurs pôles. Le trombinoscope regroupera alors ses pôles sous une seule mention Référent.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">{activePoles.map((pole) => {
              const referent = (members.data?.links ?? []).find((l) => l.pole_id === pole.id && l.is_referent);
              return <div key={pole.id} className="rounded-xl border p-4"><Label className="mb-2 block font-bold">{pole.name}</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={referent?.member_id ?? ""} onChange={(e) => saveReferent.mutate({ poleId: pole.id, memberId: e.target.value || null })}><option value="">Aucun référent</option>{activeMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>;
            })}</CardContent></Card>
        </TabsContent>

        <TabsContent value="droits"><ComingSoon title="Accès & droits" text="La matrice Moi / Mon pôle / Tous / Interdit sera consolidée ici, avec les permissions sensibles séparées." /></TabsContent>
        <TabsContent value="menus"><ComingSoon title="Menus & modules" text="Une seule configuration canonique de visibilité et d’organisation des modules sera installée ici." /></TabsContent>
        <TabsContent value="technique"><ComingSoon title="Administration technique" text="Cet espace sera réservé aux administrateurs techniques. Les secrets Supabase n’y seront jamais exposés." /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function ComingSoon({ title, text }: { title: string; text: string }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{text}</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Cette section sera activée après validation de sa logique afin de ne pas superposer l’ancien et le nouveau système.</p></CardContent></Card>; }
