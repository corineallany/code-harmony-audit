import { useQuery } from "@tanstack/react-query";

import { settingsQuery } from "@/lib/icc";

type Verse = { ref: string; text: string };

const DEFAULT_VERSES: Verse[] = [
  {
    ref: "Matthieu 6:33",
    text: "« Cherchez premièrement le royaume et la justice de Dieu; et toutes ces choses vous seront données par-dessus. »",
  },
  {
    ref: "Hébreux 6:10",
    text: "« Car Dieu n’est pas injuste, pour oublier votre travail et l’amour que vous avez montré pour son nom, ayant rendu et rendant encore des services aux saints. »",
  },
];

export function HomeHero() {
  const settings = useQuery(settingsQuery);

  const stored = Array.isArray(settings.data?.verses) ? (settings.data?.verses as Verse[]) : [];
  const verses: Verse[] = [0, 1].map((i) => {
    const v = stored[i];
    const fallback = DEFAULT_VERSES[i] as Verse;
    if (!v || (!v.ref && !v.text)) return fallback;
    return { ref: v.ref ?? fallback.ref, text: v.text ?? fallback.text };
  });

  const showCover = settings.data?.cover_enabled !== false && !!settings.data?.cover_url;
  const coverStyle = showCover
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(76, 8, 132, .88), rgba(24, 65, 177, .82)), url("${settings.data?.cover_url}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <section
      className="icc-hero flex min-h-[390px] flex-col justify-between rounded-3xl p-7 text-white shadow-xl md:p-12"
      style={coverStyle}
    >
      <div>
        <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
          ⛪ ICC Le Mans
        </p>
        <h1 className="max-w-3xl text-3xl font-black leading-tight md:text-5xl">
          Servir avec excellence,
          <br />
          communiquer avec intention.
        </h1>
        <p className="mt-4 max-w-2xl text-white/85">
          Un espace commun pour organiser les programmes, connaître l’équipe, suivre les
          sollicitations et coordonner la communication.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {verses.map((verse, i) => (
          <article key={i} className="rounded-2xl bg-white/95 p-5 text-slate-800 shadow-lg">
            <p className="mb-2 text-xs font-black uppercase text-icc-violet">{verse.ref}</p>
            <p className="font-semibold leading-relaxed">{verse.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
