import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/** Petits blocs de formulaire partagés par les écrans d'administration. */
export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={htmlFor} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * Identifiant compatible avec les colonnes UUID Supabase.
 * Le préfixe est conservé dans la signature pour ne pas casser les appels existants,
 * mais l'identifiant retourné est toujours un UUID standard.
 */
export function newId(_prefix: string) {
  return crypto.randomUUID();
}
