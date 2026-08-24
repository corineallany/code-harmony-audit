import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Pole = Tables["poles"]["Row"];
export type Member = Tables["members"]["Row"];
export type Program = Tables["programs"]["Row"];
export type Solicitation = Tables["solicitations"]["Row"];
export type AuditEntry = Tables["audit_log"]["Row"];
export type AppSettings = Tables["app_settings"]["Row"];
export type ResponseStatus = Database["public"]["Enums"]["response_status"];

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export const polesQuery = queryOptions({
  queryKey: ["poles"],
  queryFn: async () =>
    unwrap(await supabase.from("poles").select("*").order("sort_order", { ascending: true })),
});

export const membersQuery = queryOptions({
  queryKey: ["members"],
  queryFn: async () => {
    const [members, links] = await Promise.all([
      supabase.from("members").select("*").order("full_name"),
      supabase.from("member_poles").select("member_id, pole_id, is_referent"),
    ]);
    return {
      members: unwrap(members),
      links: unwrap(links),
    };
  },
});

export type ProgramWithDetails = Program & {
  assignments: Array<{
    id: string;
    pole_id: string;
    tasks: string | null;
    memberIds: string[];
  }>;
  responses: Array<{ member_id: string; status: ResponseStatus; reason: string | null }>;
};

export const programsQuery = queryOptions({
  queryKey: ["programs"],
  queryFn: async (): Promise<ProgramWithDetails[]> => {
    const [programs, assignments, assignMembers, responses] = await Promise.all([
      supabase.from("programs").select("*").eq("deleted", false).order("start_date"),
      supabase.from("program_assignments").select("id, program_id, pole_id, tasks"),
      supabase.from("program_assignment_members").select("assignment_id, member_id"),
      supabase.from("program_member_responses").select("program_id, member_id, status, reason"),
    ]);

    const rows = unwrap(programs);
    const asg = unwrap(assignments);
    const asgMembers = unwrap(assignMembers);
    const resp = unwrap(responses);

    return rows.map((p) => ({
      ...p,
      assignments: asg
        .filter((a) => a.program_id === p.id)
        .map((a) => ({
          id: a.id,
          pole_id: a.pole_id,
          tasks: a.tasks,
          memberIds: asgMembers.filter((m) => m.assignment_id === a.id).map((m) => m.member_id),
        })),
      responses: resp
        .filter((r) => r.program_id === p.id)
        .map((r) => ({ member_id: r.member_id, status: r.status, reason: r.reason })),
    }));
  },
});

export const solicitationsQuery = queryOptions({
  queryKey: ["solicitations"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("solicitations")
        .select("*")
        .eq("deleted", false)
        .order("event_date", { ascending: true }),
    ),
});

export const auditQuery = queryOptions({
  queryKey: ["audit-log"],
  queryFn: async () =>
    unwrap(
      await supabase.from("audit_log").select("*").order("occurred_at", { ascending: false }).limit(100),
    ),
});

export const settingsQuery = queryOptions({
  queryKey: ["app-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", "main").maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
});

/** Journalisation unique : un seul point d'entrée pour toute l'application. */
export async function logAction(entry: {
  action: string;
  detail?: string;
  entity?: string;
  entityId?: string;
  actorName?: string | null;
}) {
  const id = `a${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  await supabase.from("audit_log").insert({
    id,
    action: entry.action,
    detail: entry.detail ?? null,
    entity: entry.entity ?? null,
    entity_id: entry.entityId ?? null,
    actor_name: entry.actorName ?? null,
  });
}

export const RESPONSE_LABEL: Record<ResponseStatus, string> = {
  available: "Disponible",
  partial: "Partiel",
  unavailable: "Indisponible",
  pending: "En attente",
};

export const STATUS_LABEL: Record<string, string> = {
  unconfirmed: "À confirmer",
  draft: "Brouillon",
  confirmed: "Confirmé",
  pending: "En attente",
  cancelled: "Annulé",
  done: "Terminé",
  accepted: "Acceptée",
  refused: "Refusée",
};

export function formatDate(value: string | null | undefined) {
  if (!value) return "Date à définir";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
