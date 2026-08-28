import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function FinanceCorrectionShortcut() {
  const permission = useQuery({
    queryKey: ["finance-correction-shortcut"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("has_team_finance_permission", { p_action: "administrer" });
      if (error) throw error;
      return Boolean(data);
    },
  });

  if (!permission.data) return null;

  return <Button asChild size="sm" variant="outline">
    <Link to="/caisse-corrections"><Wrench className="size-4" />Corriger / annuler une écriture</Link>
  </Button>;
}
