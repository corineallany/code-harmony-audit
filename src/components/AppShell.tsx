import { Link, useRouter } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  Boxes,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useCurrentRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: false, staffOnly: false },
  { to: "/planning", label: "Planning", icon: CalendarDays, adminOnly: false, staffOnly: false },
  { to: "/programmes", label: "Programmes", icon: ClipboardList, adminOnly: false, staffOnly: false },
  { to: "/sollicitations", label: "Sollicitations", icon: Inbox, adminOnly: false, staffOnly: false },
  { to: "/trombinoscope", label: "Trombinoscope", icon: Users, adminOnly: false, staffOnly: false },
  { to: "/poles", label: "Pôles", icon: Boxes, adminOnly: false, staffOnly: false },
  { to: "/administration", label: "Administration", icon: SlidersHorizontal, adminOnly: true, staffOnly: true },
  { to: "/pilotage", label: "Pilotage", icon: ShieldCheck, adminOnly: false, staffOnly: true },
  { to: "/parametres", label: "Paramètres", icon: Settings, adminOnly: false, staffOnly: true },
] as const;


export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { role, member, isStaff, isAdmin } = useCurrentRole();
  const router = useRouter();
  const items = NAV.filter(
    (item) => (!item.staffOnly || isStaff) && (!item.adminOnly || isAdmin),
  );

  async function signOut() {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground lg:flex">
        <Link to="/tableau-de-bord" className="mb-8 block px-2">
          <p className="font-display text-lg font-semibold leading-tight">COM ICC</p>
          <p className="text-xs uppercase tracking-[0.18em] text-sidebar-primary">Le Mans</p>
        </Link>
        <nav className="flex-1 space-y-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent font-semibold text-sidebar-primary" }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-sidebar-border pt-4">
          <p className="truncate px-3 text-sm font-medium">{member?.full_name ?? "Compte"}</p>
          <p className="px-3 text-xs text-sidebar-primary">{role ? ROLE_LABEL[role] : "Sans rôle"}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" /> Se déconnecter
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold lg:text-2xl">{title}</h1>
              {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
          <div className="flex items-stretch overflow-x-auto">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[0.65rem] text-muted-foreground",
                )}
                activeProps={{ className: "text-primary font-semibold" }}
              >
                <item.icon className="size-5" />
                <span className="whitespace-nowrap">{item.label.split(" ")[0]}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
