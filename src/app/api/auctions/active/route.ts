import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { AuctionWithLead } from "@/lib/custom-types";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const activeAuctions = await prisma.auction.findMany({
      where: {
        status: "open",
        expiredAt: {
          gt: new Date(),
        },
      },
      include: {
        lead: true,
        bids: {
          include: {
            user: {
              select: {
                authUser: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedAuctions: AuctionWithLead[] = activeAuctions.map(
      (auction) => {
        const currentBid = auction.bids.length > 0 ? auction.bids[0].amount : 0;

        return {
          ...auction,
          leads: auction.lead,
          bids: auction.bids.map((bid) => ({
            ...bid,
            user: {
              name: bid.user.authUser?.name || "Participante",
            },
          })),
          // Adicionando os campos customizados
          bidders: auction.bids.length,
          currentBid: currentBid,
        };
      }
    );

    return NextResponse.json(formattedAuctions);
  } catch (error) {
    console.error("Erro detalhado ao buscar leilões ativos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor. Verifique os logs." },
      { status: 500 }
    );
  }
}
