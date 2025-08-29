import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
export async function GET(_request: Request) {
  try {
    const supabase = await createClient();

    const { data: auctions, error } = await supabase
      .from("auctions")
      .select(
        `
        id,
        minimum_bid,
        expired_at,
        bids ( amount ),
        leads ( * )
      `
      )
      .eq("status", "open");

    if (error) throw error;

    const responseData = auctions
      .map((auction) => {
        const leadData = Array.isArray(auction.leads)
          ? auction.leads[0]
          : auction.leads;
        const bidsData = Array.isArray(auction.bids) ? auction.bids : [];

        if (!leadData || typeof leadData !== "object") {
          return null;
        }

        const highestBid =
          bidsData.length > 0
            ? Math.max(...bidsData.map((b) => b.amount))
            : leadData.minimum_value || 0;

        return {
          auctionId: auction.id,
          minimumBid: auction.minimum_bid,
          currentBid: highestBid,
          expiredAt: auction.expired_at,
          lead: {
            id: leadData.id,
            name: `Lead: ${leadData.segment || "Segmento não definido"}`,
            description: leadData.description,
            companyName: leadData.company_name.substring(0, 4) + "**********",
            contactName: leadData.contact_name.substring(0, 4) + "**********",
            revenue: leadData.revenue,
            marketingInvestment: leadData.marketing_investment,
            location: leadData.location,
            segment: leadData.segment,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json(responseData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("Erro em /api/auctions/active:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
