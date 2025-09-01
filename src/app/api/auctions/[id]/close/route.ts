import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auctionId } = await params;

  if (!auctionId) {
    return NextResponse.json({ error: "Missing auction id" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: { lead: true },
      });

      if (!auction) {
        return { status: 404 as const, body: { error: "Auction not found" } };
      }

      const topBid = await tx.bid.findFirst({
        where: { auctionId: auctionId },
        orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
      });

      if (!topBid) {
        const currentLeadStatus = auction.lead?.status || "cold";
        const nextLeadStatus =
          currentLeadStatus === "hot" ? "high_frozen" : "low_frozen";

        const [updatedAuction, updatedLead] = await Promise.all([
          tx.auction.update({
            where: { id: auctionId },
            data: { status: "closed_expired", winningBidId: null },
          }),
          tx.lead.update({
            where: { id: auction.leadId },
            data: { status: nextLeadStatus },
          }),
        ]);

        return {
          status: 200 as const,
          body: {
            auction: updatedAuction,
            lead: updatedLead,
            outcome: "expired_no_bids" as const,
          },
        };
      }

      const [updatedAuction, updatedLead] = await Promise.all([
        tx.auction.update({
          where: { id: auctionId },
          data: { status: "closed_won", winningBidId: topBid.id },
        }),
        tx.lead.update({
          where: { id: auction.leadId },
          data: { status: "sold", ownerId: topBid.userId },
        }),
      ]);

      return {
        status: 200 as const,
        body: {
          auction: updatedAuction,
          lead: updatedLead,
          outcome: "won" as const,
          winningBidId: topBid.id,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error: unknown) {
    console.error("[close-auction] error:", error);
    return NextResponse.json(
      { error: "Internal error", details: String(error) },
      { status: 500 }
    );
  }
}
