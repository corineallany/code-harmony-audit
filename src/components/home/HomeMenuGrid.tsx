import { Link } from "@tanstack/react-router";

import { useCurrentRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Item = {
  icon: string;
  title: string;
  desc: string;
  to: string;
  tone?: "default" | "violet" | "dark";
  staffOnly?: boolean;
  adminOnly?: boolean;
};

/** Ordre et libellés repris de l'accueil de l'application d'origine. */
const ITEMS: Item[] = [
  { icon: "📅", title: "Planning", desc: "Calendrier général et liste chronologique.", to: "/planning" },
  {
    icon: "☑️",
    title: "Programmes",
    desc: "Statuts, dates, pôles et personnes mobilisées.",
    to: "/programmes",
  },
  {
    icon: "👥",
    title: "Trombinoscope",
    desc: "Membres, rôles, pôles et intégration.",
    to: "/trombinoscope",
  },
  {
    icon: "🤝",
    title: "Sollicitations ponctuelles",
    desc: "Renfort, ajout ou remplacement ponctuel.",
    to: "/sollicitations",
  },
  { icon: "🗂️", title: "Pôles", desc: "Référents et organisation des pôles.", to: "/poles" },
  {
    icon: "📊",
    title: "Pilotage",
    desc: "Suivi, priorités et indicateurs.",
    to: "/pilotage",
    staffOnly: true,
  },
  {
    icon: "🕒",
    title: "Disponibilités",
    desc: "Demandes, validations et conflits d’affectation.",
    to: "/conflits",
    staffOnly: true,
  },
  {
    icon: "📋",
    title: "Tâches",
    desc: "Étapes, priorités et préparation des programmes.",
    to: "/taches",
  },
  {
    icon: "📤",
    title: "Exports",
    desc: "Exports Excel des membres, programmes et sollicitations.",
    to: "/exports",
    staffOnly: true,
  },
  {
    icon: "＋",
    title: "Nouveau programme",
    desc: "Créer et affecter un nouveau programme.",
    to: "/administration",
    tone: "violet",
    adminOnly: true,
  },
  {
    icon: "⚙️",
    title: "Paramètres",
    desc: "Structure, droits et configuration.",
    to: "/parametres",
    tone: "dark",
    staffOnly: true,
  },
];

export function HomeMenuGrid() {
  const { isStaff, isAdmin } = useCurrentRole();
  const items = ITEMS.filter((i) => (!i.staffOnly || isStaff) && (!i.adminOnly || isAdmin));

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.title}
          to={item.to}
          className={cn(
            "icc-menu-card block",
            item.tone === "violet" && "bg-icc-violet text-white hover:bg-icc-violet-hover",
            item.tone === "dark" && "border-slate-800 bg-slate-800 text-white hover:bg-slate-900",
          )}
        >
          <span
            className={cn(
              "text-2xl",
              item.tone ? "text-icc-yellow" : "text-icc-violet",
            )}
          >
            {item.icon}
          </span>
          <h3 className="mt-2.5 font-black">{item.title}</h3>
          <p
            className={cn(
              "mt-1 text-xs",
              item.tone ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {item.desc}
          </p>
        </Link>
      ))}
    </div>
  );
}
