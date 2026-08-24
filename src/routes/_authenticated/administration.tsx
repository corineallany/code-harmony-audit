import { createFileRoute } from "@tanstack/react-router";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProgrammes } from "@/components/admin/AdminProgrammes";
import { AdminPoles } from "@/components/admin/AdminPoles";
import { AdminMembres } from "@/components/admin/AdminMembres";

export const Route = createFileRoute("/_authenticated/administration")({
  head: () => ({
    meta: [
      { title: "Administration — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Écrans d'administration du service Communication ICC Le Mans : gestion des programmes, des pôles et des équipiers.",
      },
      { property: "og:title", content: "Administration — COM ICC Le Mans" },
      { property: "og:description", content: "Gestion des programmes, des pôles et des équipiers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Administration,
});

function Administration() {
  const { isAdmin, loading } = useCurrentRole();

  if (loading) {
    return <AppShell title="Administration" />;
  }

  if (!isAdmin) {
    return (
      <AppShell title="Administration">
        <EmptyState
          title="Accès réservé"
          description="Seuls la responsable, un adjoint ou l'administrateur technique peuvent gérer ces données."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Administration" subtitle="Programmes, pôles et équipiers">
      <Tabs defaultValue="programmes">
        <TabsList className="mb-5">
          <TabsTrigger value="programmes">Programmes</TabsTrigger>
          <TabsTrigger value="poles">Pôles</TabsTrigger>
          <TabsTrigger value="membres">Équipiers</TabsTrigger>
        </TabsList>
        <TabsContent value="programmes">
          <AdminProgrammes />
        </TabsContent>
        <TabsContent value="poles">
          <AdminPoles />
        </TabsContent>
        <TabsContent value="membres">
          <AdminMembres />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
