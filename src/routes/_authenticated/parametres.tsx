import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { formatDateTime, settingsQuery } from "@/lib/icc";
import { ROLE_LABEL, useCurrentRole } from "@/hooks/useAuth";
import { usePush } from "@/hooks/usePush";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/push.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — COM ICC Le Mans" },
      {
        name: "description",
        content: "Paramètres de l'espace équipe : rôles, permissions et informations techniques de la base unique.",
      },
      { property: "og:title", content: "Paramètres — COM ICC Le Mans" },
      { property: "og:description", content: "Rôles, permissions et informations de la base de données unique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Parametres,
});

function Parametres() {
  const settings = useQuery(settingsQuery);
  const { role, member, userId } = useCurrentRole();
  const push = usePush(userId);
  const [testSent, setTestSent] = useState(false);

  const permissions = useQuery({
    queryKey: ["role-permissions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role, permission");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const byRole = new Map<string, string[]>();
  for (const p of permissions.data ?? []) {
    byRole.set(p.role, [...(byRole.get(p.role) ?? []), p.permission]);
  }

  const testPushMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Non connecté");
      return sendNotification({
        userIds: [userId],
        type: "test",
        title: "Notification de test",
        body: "Les notifications push fonctionnent correctement.",
        link: "/parametres",
      });
    },
    onSuccess: () => {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 5000);
    },
  });

  return (
    <AppShell title="Paramètres" subtitle="Rôles, permissions et référence technique">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mon compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Équipier lié : </span>
              {member?.full_name ?? "Aucun"}
            </p>
            <p>
              <span className="text-muted-foreground">Rôle : </span>
              {role ? ROLE_LABEL[role] : "Sans rôle"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Base de données</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Nom de l’application : </span>
              {settings.data?.home_title ?? "COM ICC Le Mans"}
            </p>
            <p>
              <span className="text-muted-foreground">Dernière mise à jour : </span>
              {formatDateTime(settings.data?.updated_at)}
            </p>
            <p className="text-muted-foreground">
              Toutes les données métier proviennent d’une base unique — aucune donnée locale concurrente.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications push</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Recevez des alertes sur votre appareil pour les nouvelles solicitations, changements de planning et rappels.
            </p>
            {push.state === "unsupported" ? (
              <p className="text-sm text-muted-foreground">Notifications push non supportées par ce navigateur.</p>
            ) : push.state === "denied" ? (
              <p className="text-sm text-destructive">
                Notifications refusées. Autorisez-les dans les paramètres du navigateur.
              </p>
            ) : push.subscribed ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <Bell className="size-4" /> Notifications activées
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={push.disable}>
                    <BellOff className="size-4" /> Désactiver
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => testPushMut.mutate()}
                    disabled={testPushMut.isPending || testSent}
                  >
                    <Send className="size-4" /> {testSent ? "Envoyé ✓" : "Tester"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" onClick={push.enable} disabled={push.state === "loading"}>
                <Bell className="size-4" /> Activer les notifications
              </Button>
            )}
            {push.error && <p className="text-xs text-destructive">{push.error}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Permissions par rôle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...byRole.entries()].map(([roleKey, perms]) => (
              <div key={roleKey}>
                <p className="font-medium">{ROLE_LABEL[roleKey as keyof typeof ROLE_LABEL] ?? roleKey}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {perms.map((perm) => (
                    <Badge key={perm} variant="secondary" className="text-[0.7rem] font-normal">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
