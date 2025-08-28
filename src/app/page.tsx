import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import { sortLeads } from "@/lib/sortLeads";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth";
import type { Lead as AuctionLead } from "@/components/dashboard/leads/types";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const supabase = await createClient();

  const { data: auctionLeads, error: auctionError } = await supabase
    .from('leads')
    .select('*')
    .is('owner_id', null)
    .gt('expires_at', new Date().toISOString());

  if (auctionError) {
    console.error("Erro ao buscar leilões:", auctionError.message);
  }
  const sortedAuctionLeads = sortLeads(auctionLeads || []);

  let purchasedLeads: AuctionLead[] = [];
  if (session?.user?.id) {
    const { data: ownedLeads, error: purchasedError } = await supabase
      .from('leads')
      .select('*')
      .eq('owner_id', session.user.id);

    if (purchasedError) {
      console.error("Erro ao buscar leads comprados:", purchasedError.message);
    }
    purchasedLeads = (ownedLeads as AuctionLead[]) || [];
  }

  return (
    <>
      <Dashboard
        initialLeads={sortedAuctionLeads as AuctionLead[]}
        initialPurchasedLeads={purchasedLeads}
      />
    </>
  );
}