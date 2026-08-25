import { createFileRoute } from "@tanstack/react-router";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProgrammes } from "@/components/admin/AdminProgrammes";
import { AdminPoles } from "@/components/admin/AdminPoles";
import { AdminMembres } from "@/components/admin/AdminMembres";

export const Route = createFileRoute("/_authenticated/administration")({
  validateSearch: (search: Record<string, unknown>) => ({ newProgram: search.newProgram === "1" ? "1" : undefined }),
  component: Administration,
});

function Administration() {
  const { isAdmin, loading } = useCurrentRole();
  const { newProgram } = Route.useSearch();
  if (loading) return <AppShell title="Administration"><p className="text-sm text-muted-foreground">Chargement…</p></AppShell>;
  if (!isAdmin) return <AppShell title="Administration"><EmptyState title="Accès réservé" description="Seuls la responsable, un adjoint ou l'administrateur technique peuvent gérer ces données." /></AppShell>;
  return (
    <AppShell title="Administration" subtitle="Programmes, pôles et équipiers">
      <Tabs defaultValue="programmes">
        <TabsList className="mb-5"><TabsTrigger value="programmes">Programmes</TabsTrigger><TabsTrigger value="poles">Pôles</TabsTrigger><TabsTrigger value="membres">Équipiers</TabsTrigger></TabsList>
        <TabsContent value="programmes"><AdminProgrammes openNewOnMount={newProgram === "1"} /></TabsContent>
        <TabsContent value="poles"><AdminPoles /></TabsContent>
        <TabsContent value="membres"><AdminMembres /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
