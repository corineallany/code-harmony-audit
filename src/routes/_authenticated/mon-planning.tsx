import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { formatDate, polesQuery, programsQuery, RESPONSE_LABEL, STATUS_LABEL } from "@/lib/icc";

export const Route = createFileRoute("/_authenticated/mon-planning")({
  head: () => ({
    meta: [
      { title: "Mon planning — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Vos services, confirmations, remplacements et rappels au sein du pôle Communication ICC Le Mans.",
      },
      { property: "og:title", content: "Mon planning — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Programmes et sollicitations qui concernent votre profil et vos pôles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonPlanning,
});

function MonPlanning() {
  const { member } = useCurrentRole();
  const programs = useQuery(programsQuery);
  const poles = useQuery(polesQuery);

  const memberId = member?.id ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const mine = memberId
    ? (programs.data ?? []).filter((p) => p.assignments.some((a) => a.memberIds.includes(memberId)))
    : [];
  const upcoming = mine.filter((p) => (p.start_date ?? "9999") >= today);
  const past = mine.filter((p) => (p.start_date ?? "9999") < today);
  const toConfirm = upcoming.filter(
    (p) => !p.responses.some((r) => r.member_id === memberId && r.status !== "pending"),
  );

  const poleName = (id: string) => poles.data?.find((p) => p.id === id)?.name ?? "Pôle";

  const kpis = [
    { label: "Services à venir", value: upcoming.length },
    { label: "À confirmer", value: toConfirm.length },
    { label: "Services passés", value: past.length },
    { label: "Total de mes services", value: mine.length },
  ];

  return (
    <AppShell title="Mon planning" subtitle="Vos services, confirmations, remplacements et rappels.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-4">
            <b className="block text-2xl text-icc-violet">{k.value}</b>
            <small className="text-muted-foreground">{k.label}</small>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        {mine.length === 0 ? (
          <EmptyState
            title="Aucun service enregistré"
            description="Vos affectations apparaîtront ici dès qu'un programme vous mobilisera."
          />
        ) : (
          <div className="space-y-2">
            {[...upcoming, ...past].map((p) => {
              const response = p.responses.find((r) => r.member_id === memberId);
              const myPoles = p.assignments
                .filter((a) => memberId && a.memberIds.includes(memberId))
                .map((a) => poleName(a.pole_id));
              return (
                <div key={p.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-bold">{p.title}</p>
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                      {response ? RESPONSE_LABEL[response.status] : "À confirmer"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(p.start_date)} · {STATUS_LABEL[p.status] ?? p.status}
                    {myPoles.length ? ` · ${myPoles.join(", ")}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
