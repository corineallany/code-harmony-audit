import { createFileRoute } from "@tanstack/react-router";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { AdminProgrammes } from "@/components/admin/AdminProgrammes";

export const Route = createFileRoute("/_authenticated/administration")({
  validateSearch: (search: Record<string, unknown>) => ({ newProgram: search.newProgram === "1" ? "1" : undefined }),
  component: Administration,
});

function Administration() {
  const { isAdmin, loading } = useCurrentRole();
  const { newProgram } = Route.useSearch();
  if (loading) return <AppShell title="Administration des programmes"><p className="text-sm text-muted-foreground">Chargement…</p></AppShell>;
  if (!isAdmin) return <AppShell title="Administration des programmes"><EmptyState title="Accès réservé" description="Seuls la responsable, un adjoint ou l'administrateur technique peuvent gérer ces données." /></AppShell>;
  return (
    <AppShell title="Administration des programmes" subtitle="Créer, modifier et archiver les programmes">
      <AdminProgrammes openNewOnMount={newProgram === "1"} />
    </AppShell>
  );
}
