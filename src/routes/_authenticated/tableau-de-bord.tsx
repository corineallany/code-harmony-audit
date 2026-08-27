import { createFileRoute } from "@tanstack/react-router";

import { IccHeader } from "@/components/IccHeader";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeMenuGrid } from "@/components/home/HomeMenuGrid";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { TeamLifePanel } from "@/components/home/TeamLifePanel";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Accueil — COM ICC Le Mans" },
      { name: "description", content: "Accueil du pôle Communication ICC Le Mans : versets, accès aux modules, tableau de bord personnel et vie d’équipe." },
      { property: "og:title", content: "Accueil — COM ICC Le Mans" },
      { property: "og:description", content: "Accès aux modules du pôle Communication, tableau de bord personnel et vie d’équipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <IccHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <HomeHero />
        <HomeMenuGrid />
        <HomeDashboard />
        <TeamLifePanel />
      </main>
    </div>
  );
}
