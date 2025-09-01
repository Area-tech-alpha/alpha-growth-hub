import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import { AuctionWithLead, LeadForAuction } from "@/lib/custom-types";
import { Prisma } from "@prisma/client";

interface SupabaseBid {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
}
interface SupabaseLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  revenue: number;
  marketing_investment: number;
  location: string | null;
  segment: string;
  minimum_value: number | null;
  status: string;
  channel: string | null;
  owner_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}
interface SupabaseAuction {
  id: string;
  lead_id: string;
  minimum_bid: number;
  status: string;
  winning_bid_id: string | null;
  expired_at: string;
  created_at: string | null;
  leads: SupabaseLead;
  bids: SupabaseBid[];
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [auctionsResult, purchasedLeadsResult] = await Promise.all([
    supabase
      .from("auctions")
      .select("*, leads(*), bids!bids_auction_id_fkey(*)")
      .eq("status", "open")
      .gt("expired_at", new Date().toISOString()),
    user
      ? supabase
          .from("leads")
          .select("*")
          .eq("owner_id", user.id)
          .eq("status", "sold")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const { data: initialAuctionsFromSupabase, error: auctionsError } =
    auctionsResult;
  const { data: purchasedLeadsFromSupabase, error: leadsError } =
    purchasedLeadsResult;

  if (auctionsError || leadsError || !initialAuctionsFromSupabase) {
    console.error(
      "Erro ao buscar dados iniciais:",
      auctionsError?.message || leadsError?.message
    );
    return <Dashboard initialAuctions={[]} initialPurchasedLeads={[]} />;
  }

  const initialAuctions: AuctionWithLead[] = initialAuctionsFromSupabase.map(
    (auction: SupabaseAuction) => {
      const formattedLead: LeadForAuction = {
        id: auction.leads.id,
        companyName: auction.leads.company_name,
        contactName: auction.leads.contact_name ?? "",
        phone: auction.leads.phone ?? "",
        email: auction.leads.email ?? "",
        revenue: new Prisma.Decimal(auction.leads.revenue),
        marketingInvestment: new Prisma.Decimal(
          auction.leads.marketing_investment
        ),
        location: auction.leads.location,
        segment: auction.leads.segment,
        minimumValue:
          auction.leads.minimum_value !== null
            ? new Prisma.Decimal(auction.leads.minimum_value)
            : null,
        status: auction.leads.status,
        channel: auction.leads.channel,
        ownerId: auction.leads.owner_id,
        createdAt: auction.leads.created_at
          ? new Date(auction.leads.created_at)
          : null,
        updatedAt: auction.leads.updated_at
          ? new Date(auction.leads.updated_at)
          : null,
        expires_at: auction.expired_at,
      };

      return {
        id: auction.id,
        leadId: auction.lead_id,
        minimumBid: new Prisma.Decimal(auction.minimum_bid),
        status: auction.status,
        winningBidId: auction.winning_bid_id,
        expiredAt: new Date(auction.expired_at),
        createdAt: auction.created_at ? new Date(auction.created_at) : null,
        leads: formattedLead,
        bids: (auction.bids || []).map((b) => ({
          id: b.id,
          userId: b.user_id,
          amount: new Prisma.Decimal(b.amount),
          createdAt: new Date(b.created_at),
          auctionId: auction.id,
          user: { name: "Carregando..." },
        })),
        bidders: auction.bids?.length || 0,
        currentBid:
          auction.bids?.length > 0
            ? new Prisma.Decimal(Math.max(...auction.bids.map((b) => b.amount)))
            : new Prisma.Decimal(0),
      };
    }
  );

  const initialPurchasedLeads: LeadForAuction[] = (
    purchasedLeadsFromSupabase || []
  ).map(
    (lead: SupabaseLead): LeadForAuction => ({
      id: lead.id,
      companyName: lead.company_name,
      contactName: lead.contact_name ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      revenue: new Prisma.Decimal(lead.revenue),
      marketingInvestment: new Prisma.Decimal(lead.marketing_investment),
      location: lead.location,
      segment: lead.segment,
      minimumValue:
        lead.minimum_value !== null
          ? new Prisma.Decimal(lead.minimum_value)
          : null,
      status: lead.status,
      channel: lead.channel,
      ownerId: lead.owner_id,
      createdAt: lead.created_at ? new Date(lead.created_at) : null,
      updatedAt: lead.updated_at ? new Date(lead.updated_at) : null,
      expires_at: "",
    })
  );

  return (
    <>
      <Dashboard
        initialAuctions={initialAuctions}
        initialPurchasedLeads={initialPurchasedLeads}
      />
    </>
  );
}
