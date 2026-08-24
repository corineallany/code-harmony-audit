import type { Database } from "@/integrations/supabase/types";

export type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"];
export type EvaluationKind = "operational" | "referent" | "leadership";
export type EvaluationStatus = "draft" | "submitted" | "revision" | "validated";

export const EVAL_KIND_LABEL: Record<EvaluationKind, string> = {
  operational: "Travail opérationnel",
  referent: "Rôle de Référent",
  leadership: "Leadership / Responsable",
};

export const EVAL_STATUS_LABEL: Record<EvaluationStatus, string> = {
  draft: "Brouillon",
  submitted: "Soumise au Responsable",
  revision: "Révision demandée",
  validated: "Validée",
};

export type Criterion = { id: string; label: string };

/** Blocs de critères validés dans THE Consolidation (§9 à §12). */
export const EVAL_CRITERIA: Record<EvaluationKind, Criterion[]> = {
  operational: [
    { id: "qualite", label: "Qualité du travail" },
    { id: "fiabilite", label: "Fiabilité et ponctualité" },
    { id: "implication", label: "Implication et engagement" },
    { id: "communication", label: "Communication" },
    { id: "equipe", label: "Esprit d’équipe" },
    { id: "autonomie", label: "Autonomie" },
    { id: "progression", label: "Progression" },
  ],
  referent: [
    { id: "accompagnement", label: "Accompagnement des membres" },
    { id: "disponibilite", label: "Disponibilité et écoute" },
    { id: "organisation_pole", label: "Organisation du pôle" },
    { id: "anticipation", label: "Anticipation" },
    { id: "repartition", label: "Répartition des responsabilités" },
    { id: "mobilisation", label: "Mobilisation de l’équipe" },
    { id: "formation", label: "Suivi des personnes en formation" },
    { id: "transmission", label: "Transmission des informations" },
    { id: "difficultes", label: "Gestion des difficultés" },
    { id: "developpement", label: "Développement des membres" },
    { id: "collaboration", label: "Collaboration référents / direction" },
    { id: "initiative", label: "Initiative" },
    { id: "exemplarite", label: "Exemplarité" },
  ],
  leadership: [
    { id: "ecoute", label: "Écoute" },
    { id: "equite", label: "Équité" },
    { id: "communication_l", label: "Communication" },
    { id: "accompagnement_l", label: "Accompagnement" },
    { id: "federer", label: "Capacité à fédérer" },
    { id: "organisation_l", label: "Organisation" },
    { id: "decision", label: "Prise de décision" },
    { id: "difficultes_l", label: "Gestion des difficultés" },
    { id: "exemplarite_l", label: "Exemplarité" },
    { id: "developpement_l", label: "Développement des personnes" },
  ],
};

export type Scores = Record<string, number>;

export function asScores(value: unknown): Scores {
  if (!value || typeof value !== "object") return {};
  const out: Scores = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Moyenne d'une évaluation sur les critères réellement renseignés (échelle 1-5). */
export function averageScore(scores: Scores): number | null {
  const values = Object.values(scores).filter((n) => n > 0);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
