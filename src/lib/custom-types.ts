import type {
  Lead as PrismaLead,
  Auction as PrismaAuction,
} from "@prisma/client";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  creditBalance: number;
}

export interface BidWithUserName {
  id: string;
  userId: string;
  auctionId: string;
  amount: { toNumber(): number };
  createdAt: Date | null;
  user: {
    name: string | null;
  };
}

export interface AuctionWithLead extends Omit<PrismaAuction, "minimumBid"> {
  leads: Omit<
    PrismaLead,
    "revenue" | "marketingInvestment" | "minimumValue"
  > & {
    revenue: { toNumber(): number };
    marketingInvestment: { toNumber(): number };
    minimumValue: { toNumber(): number } | null;
  };
  bids: BidWithUserName[];
  minimumBid: { toNumber(): number };
  bidders?: number | { toNumber(): number };
  currentBid?: number | { toNumber(): number };
}

export interface PurchasedLead {
  purchaseDate: Date;
  purchasePrice: number;
  lead: PrismaLead;
}

export interface AuctionRow {
  id: string;
  status: string;
  expired_at: string;
  lead_id: string;
}

export type LeadForAuction = PrismaLead & { expires_at: string };

export interface AuctionRecord extends Omit<PrismaAuction, "leadId" | "lead"> {
  leads: PrismaLead;
}

export interface AuctionWithLeadUI
  extends Omit<PrismaAuction, "leadId" | "lead"> {
  leads: LeadForAuction;
  [key: string]: unknown;
}
