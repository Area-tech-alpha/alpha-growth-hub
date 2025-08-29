import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth";
import type { Lead as AuctionLead } from "@/components/dashboard/leads/types";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const supabase = await createClient();

  const { data: initialAuctions, error: auctionError } = await supabase
    .from('auctions')
    .select('*, leads(*)')
    .eq('status', 'open')
    .gt('expired_at', new Date().toISOString());

  if (auctionError) {
    console.error("[Home] Erro ao buscar leilões:", auctionError.message);
  } else {
    console.log('[Home] initialAuctions count:', initialAuctions?.length ?? 0)
  }

  let purchasedLeads: AuctionLead[] = [];
  if (session?.user?.id) {
    const { data: ownedLeads, error: purchasedError } = await supabase
      .from('leads')
      .select('*')
      .eq('owner_id', session.user.id);

    if (purchasedError) {
      console.error("[Home] Erro ao buscar leads comprados:", purchasedError.message);
    }
    purchasedLeads = (ownedLeads as AuctionLead[]) || [];
  }

  return (
    <>
      <Dashboard
        initialAuctions={initialAuctions || []}
        initialPurchasedLeads={purchasedLeads}
      />
    </>
  );
}
