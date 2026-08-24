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

export function newId(prefix: string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}
