import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import { AuctionWithLead } from "@/lib/custom-types";
import { Lead } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

interface SupabaseLead {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  revenue: number;
  marketing_investment: number;
  location: string | null;
  segment: string | null;
  minimum_value: number | null;
  status: string;
  channel: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseAuction {
  id: string;
  lead_id: string;
  minimum_bid: number;
  status: string;
  winning_bid_id: string | null;
  expired_at: string;
  created_at: string;
  leads: SupabaseLead;
}

export default async function Home() {
  const supabase = await createClient();

  const { data: initialAuctionsFromSupabase, error } = await supabase
    .from("auctions")
    .select("*, leads(*)")
    .eq("status", "open")
    .gt("expired_at", new Date().toISOString());

  if (error) {
    console.error("Erro ao buscar leilões iniciais:", error.message);
    return <Dashboard initialAuctions={[]} />;
  }

  const initialAuctions: AuctionWithLead[] = initialAuctionsFromSupabase.map(
    (auction: SupabaseAuction) => {
      const formattedLead: Lead = {
        id: auction.leads.id,
        companyName: auction.leads.company_name,
        contactName: auction.leads.contact_name,
        phone: auction.leads.phone,
        email: auction.leads.email,
        revenue: new Decimal(auction.leads.revenue),
        marketingInvestment: new Decimal(auction.leads.marketing_investment),
        location: auction.leads.location,
        segment: auction.leads.segment,
        minimumValue: auction.leads.minimum_value
          ? new Decimal(auction.leads.minimum_value)
          : null,
        status: auction.leads.status,
        channel: auction.leads.channel,
        ownerId: auction.leads.owner_id,
        createdAt: new Date(auction.leads.created_at),
        updatedAt: new Date(auction.leads.updated_at),
      };

      return {
        id: auction.id,
        leadId: auction.lead_id,
        minimumBid: new Decimal(auction.minimum_bid),
        status: auction.status,
        winningBidId: auction.winning_bid_id,
        expiredAt: new Date(auction.expired_at),
        createdAt: new Date(auction.created_at),
        leads: formattedLead,
      };
    }
  );

  return (
    <>
      <Dashboard initialAuctions={initialAuctions} />
    </>
  );
}
