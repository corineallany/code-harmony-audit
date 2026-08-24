import type { Member, ProgramWithDetails } from "@/lib/icc";

export type AvailabilityRow = {
  id: string;
  member_id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  status?: string | null;
};

export type ConflictKind = "overlap" | "unavailable" | "absence" | "no_pole" | "no_member" | "pending";

export type Conflict = {
  id: string;
  kind: ConflictKind;
  severity: "high" | "medium" | "low";
  programId: string;
  programTitle: string;
  date: string | null;
  message: string;
};

const SEVERITY: Record<ConflictKind, Conflict["severity"]> = {
  overlap: "high",
  unavailable: "high",
  absence: "high",
  no_pole: "medium",
  no_member: "medium",
  pending: "low",
};

export const CONFLICT_LABEL: Record<ConflictKind, string> = {
  overlap: "Chevauchement",
  unavailable: "Indisponibilité déclarée",
  absence: "Absence planifiée",
  no_pole: "Aucun pôle affecté",
  no_member: "Pôle sans équipier",
  pending: "Réponses en attente",
};

function minutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hours = Number(h);
  const mins = Number(m ?? "0");
  if (Number.isNaN(hours)) return null;
  return hours * 60 + (Number.isNaN(mins) ? 0 : mins);
}

/** Créneau d'un programme en minutes depuis minuit ; par défaut 2 h si l'heure de fin manque. */
function slot(program: ProgramWithDetails): { start: number; end: number } | null {
  const start = minutes(program.start_time);
  if (start === null) return null;
  const end = minutes(program.end_time);
  return { start, end: end !== null && end > start ? end : start + 120 };
}

function memberIdsOf(program: ProgramWithDetails): string[] {
  return [...new Set(program.assignments.flatMap((a) => a.memberIds))];
}

/** Moteur unique de détection des conflits de planning. Aucune écriture, calcul pur. */
export function detectConflicts(
  programs: ProgramWithDetails[],
  members: Member[],
  availability: AvailabilityRow[],
): Conflict[] {
  const nameOf = new Map(members.map((m) => [m.id, m.full_name]));
  const active = programs.filter((p) => !p.archived && p.status !== "cancelled");
  const out: Conflict[] = [];

  // 1. Chevauchements de créneaux avec équipier partagé (ou même horaire exact).
  const byDate = new Map<string, ProgramWithDetails[]>();
  for (const p of active) {
    if (!p.start_date) continue;
    byDate.set(p.start_date, [...(byDate.get(p.start_date) ?? []), p]);
  }
  for (const [date, list] of byDate) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        const sa = slot(a);
        const sb = slot(b);
        if (!sa || !sb) continue;
        if (sa.start >= sb.end || sb.start >= sa.end) continue;
        const shared = memberIdsOf(a).filter((id) => memberIdsOf(b).includes(id));
        if (shared.length === 0) continue;
        out.push({
          id: `overlap-${a.id}-${b.id}`,
          kind: "overlap",
          severity: SEVERITY.overlap,
          programId: a.id,
          programTitle: a.title,
          date,
          message: `Créneau superposé avec « ${b.title} » — ${shared
            .map((id) => nameOf.get(id) ?? id)
            .join(", ")} affecté(s) aux deux.`,
        });
      }
    }
  }

  for (const p of active) {
    const assigned = memberIdsOf(p);

    // 2. Réponses négatives d'équipiers affectés.
    for (const r of p.responses) {
      if (r.status === "unavailable" && assigned.includes(r.member_id)) {
        out.push({
          id: `unavailable-${p.id}-${r.member_id}`,
          kind: "unavailable",
          severity: SEVERITY.unavailable,
          programId: p.id,
          programTitle: p.title,
          date: p.start_date,
          message: `${nameOf.get(r.member_id) ?? r.member_id} s'est déclaré indisponible${
            r.reason ? ` (${r.reason})` : ""
          } mais reste affecté.`,
        });
      }
    }

    // 3. Absences planifiées couvrant la date du programme.
    if (p.start_date) {
      const day = new Date(`${p.start_date}T12:00:00`).getTime();
      for (const a of availability) {
        if (!assigned.includes(a.member_id)) continue;
        if (a.status === "refused") continue; // une indisponibilité refusée ne bloque pas
        const from = new Date(a.starts_at).getTime();
        const to = new Date(a.ends_at).getTime();
        if (day < from || day > to) continue;
        out.push({
          id: `absence-${p.id}-${a.id}`,
          kind: "absence",
          severity: SEVERITY.absence,
          programId: p.id,
          programTitle: p.title,
          date: p.start_date,
          message: `${nameOf.get(a.member_id) ?? a.member_id} est absent(e) sur cette période${
            a.note ? ` (${a.note})` : ""
          }.`,
        });
      }
    }

    // 4. Couverture incomplète.
    if (p.assignments.length === 0) {
      out.push({
        id: `no_pole-${p.id}`,
        kind: "no_pole",
        severity: SEVERITY.no_pole,
        programId: p.id,
        programTitle: p.title,
        date: p.start_date,
        message: "Aucun pôle n'est affecté à ce programme.",
      });
    } else {
      const empty = p.assignments.filter((a) => a.memberIds.length === 0).length;
      if (empty > 0) {
        out.push({
          id: `no_member-${p.id}`,
          kind: "no_member",
          severity: SEVERITY.no_member,
          programId: p.id,
          programTitle: p.title,
          date: p.start_date,
          message: `${empty} pôle(s) affecté(s) sans équipier désigné.`,
        });
      }
    }

    // 5. Réponses manquantes.
    const answered = new Set(p.responses.filter((r) => r.status !== "pending").map((r) => r.member_id));
    const waiting = assigned.filter((id) => !answered.has(id));
    if (waiting.length > 0) {
      out.push({
        id: `pending-${p.id}`,
        kind: "pending",
        severity: SEVERITY.pending,
        programId: p.id,
        programTitle: p.title,
        date: p.start_date,
        message: `${waiting.length} équipier(s) n'ont pas encore répondu.`,
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] || (a.date ?? "9999").localeCompare(b.date ?? "9999"),
  );
}
