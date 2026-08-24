import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "COM ICC Le Mans — Pilotage du pôle Communication" },
      {
        name: "description",
        content:
          "Plateforme unique du pôle Communication ICC Le Mans : planning des cultes, programmes, affectations par pôle, sollicitations et disponibilités des équipiers.",
      },
      { property: "og:title", content: "COM ICC Le Mans — Pilotage du pôle Communication" },
      {
        property: "og:description",
        content:
          "Planning, programmes, affectations et sollicitations du pôle Communication ICC Le Mans, réunis dans un espace unique.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Planning unifié",
    text: "Tous les cultes et événements dans un calendrier unique, sans doublon ni version concurrente.",
  },
  {
    icon: ClipboardList,
    title: "Programmes & affectations",
    text: "Chaque pôle voit ses tâches, chaque équipier confirme sa disponibilité en un geste.",
  },
  {
    icon: Users,
    title: "Équipe & pôles",
    text: "Trombinoscope, référents et permissions par rôle, alignés sur une seule base de données.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <div>
          <p className="font-display text-lg font-semibold">COM ICC</p>
          <p className="text-xs uppercase tracking-[0.2em] text-sidebar-primary">Le Mans</p>
        </div>
        <Link
          to="/auth"
          className="rounded-lg bg-sidebar-primary px-4 py-2 text-sm font-semibold text-sidebar-primary-foreground"
        >
          Espace équipe
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="pt-8 lg:pt-16">
          <p className="text-xs uppercase tracking-[0.25em] text-sidebar-primary">Pôle Communication</p>
          <h1 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight lg:text-5xl">
            Un seul outil pour organiser le service du pôle Communication
          </h1>
          <p className="mt-5 max-w-xl text-sm text-sidebar-foreground/75 lg:text-base">
            Planning, programmes, affectations, sollicitations et disponibilités : toutes les données de
            l’équipe réunies dans une base unique, fiable et à jour.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex rounded-lg bg-sidebar-primary px-5 py-3 text-sm font-semibold text-sidebar-primary-foreground"
          >
            Se connecter
          </Link>
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-xl border border-sidebar-border bg-sidebar-accent p-5">
              <f.icon className="size-5 text-sidebar-primary" />
              <h2 className="mt-3 font-display text-base font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-sidebar-foreground/70">{f.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
