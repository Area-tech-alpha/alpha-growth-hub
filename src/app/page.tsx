import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import { AuctionWithLead } from "@/lib/custom-types";

interface SupabaseBid {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
}
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

  const { data: initialAuctionsFromSupabase, error } = await supabase
    .from("auctions")
    .select("*, leads(*), bids!bids_auction_id_fkey(*)")
    .eq("status", "open")
    .gt("expired_at", new Date().toISOString());

  if (error || !initialAuctionsFromSupabase) {
    console.error("Erro ao buscar leilões iniciais:", error?.message);
    return <Dashboard initialAuctions={[]} />;
  }

  const initialAuctions: AuctionWithLead[] = initialAuctionsFromSupabase.map(
    (auction: SupabaseAuction) => {
      const formattedLead = {
        id: auction.leads.id,
        companyName: auction.leads.company_name,
        contactName: auction.leads.contact_name,
        phone: auction.leads.phone,
        email: auction.leads.email,
        revenue: { toNumber: () => auction.leads.revenue } as {
          toNumber(): number;
        },
        marketingInvestment: {
          toNumber: () => auction.leads.marketing_investment,
        } as { toNumber(): number },
        location: auction.leads.location,
        segment: auction.leads.segment,
        minimumValue: auction.leads.minimum_value
          ? ({ toNumber: () => auction.leads.minimum_value } as {
              toNumber(): number;
            })
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
      };

      return {
        id: auction.id,
        leadId: auction.lead_id,
        minimumBid: { toNumber: () => auction.minimum_bid } as {
          toNumber(): number;
        },
        status: auction.status,
        winningBidId: auction.winning_bid_id,
        expiredAt: new Date(auction.expired_at),
        createdAt: auction.created_at ? new Date(auction.created_at) : null,
        leads: formattedLead,
        bids: (auction.bids || []).map((b) => ({
          id: b.id,
          userId: b.user_id,
          amount: { toNumber: () => b.amount } as { toNumber(): number },
          createdAt: new Date(b.created_at),
          auctionId: auction.id,
          user: { name: "Carregando..." },
        })),
        bidders: auction.bids?.length || 0,
        currentBid:
          auction.bids && auction.bids.length > 0
            ? Math.max(...auction.bids.map((b) => b.amount))
            : ({ toNumber: () => 0 } as { toNumber(): number }),
      };
    }
  );

  return (
    <>
      <Dashboard initialAuctions={initialAuctions} />
    </>
  );
}
