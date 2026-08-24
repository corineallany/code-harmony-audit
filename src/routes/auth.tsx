import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — Espace équipe COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Connectez-vous à l'espace équipe du pôle Communication de l'ICC Le Mans : planning, programmes, sollicitations et affectations.",
      },
      { property: "og:title", content: "Connexion — Espace équipe COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Accès réservé aux membres du pôle Communication de l'ICC Le Mans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/tableau-de-bord" });
    });
  }, [router]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Connexion impossible", { description: error.message });
      return;
    }
    router.navigate({ to: "/tableau-de-bord" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <p className="font-display text-xl font-semibold">COM ICC Le Mans</p>
        <p className="mt-1 text-sm text-muted-foreground">Espace équipe — accès réservé.</p>

        <form onSubmit={signIn} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

      </div>
    </div>
  );
}
