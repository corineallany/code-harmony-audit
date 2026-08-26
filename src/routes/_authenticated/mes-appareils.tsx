import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, MonitorSmartphone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentRole } from "@/hooks/useAuth";
import { usePush } from "@/hooks/usePush";

export const Route = createFileRoute("/_authenticated/mes-appareils")({ component: MesAppareils });

function MesAppareils() {
  const { userId } = useCurrentRole();
  const push = usePush(userId);
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "Cet appareil";
  return <AppShell title="Mes appareils / Push" subtitle="Gérez les appareils sur lesquels vous recevez les notifications">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MonitorSmartphone className="size-5"/> Cet appareil</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b>Appareil actuel</b><Badge variant={push.subscribed ? "default" : "secondary"}>{push.subscribed ? "Push activé" : "Push désactivé"}</Badge></div><p className="mt-2 break-words text-xs text-muted-foreground">{device}</p></div>
        {push.state === "unsupported" ? <p className="text-muted-foreground">Les notifications push ne sont pas supportées sur ce navigateur.</p> : push.state === "denied" ? <p className="text-destructive">Les notifications sont bloquées dans les réglages du navigateur.</p> : push.subscribed ? <Button variant="outline" onClick={push.disable}><BellOff className="size-4"/> Désactiver et retirer cet appareil</Button> : <Button onClick={push.enable} disabled={push.state === "loading"}><Bell className="size-4"/> Activer les notifications sur cet appareil</Button>}
        {push.error ? <p className="text-xs text-destructive">{push.error}</p> : null}
        <p className="text-xs text-muted-foreground">Chaque navigateur/appareil doit être activé séparément. La gestion centralisée de tous les appareils enregistrés sera affichée ici dès que la liste serveur des abonnements sera exposée à l’utilisateur.</p>
      </CardContent></Card>
  </AppShell>;
}
