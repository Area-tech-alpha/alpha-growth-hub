import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import { sortLeads } from "@/lib/sortLeads";
import type { Lead as AuctionLead } from "@/components/dashboard/leads/types";

export default async function Home() {
  const supabase = await createClient();

  const { data: initialLeads, error } = await supabase
    .from('leads')
    .select('*')
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error("Erro ao buscar leads iniciais:", error.message);
  }

  const sortedInitialLeads: AuctionLead[] = sortLeads((initialLeads as unknown as AuctionLead[]) || []);

  return (
    <>
      <Dashboard initialLeads={sortedInitialLeads} />
    </>
  );
}
