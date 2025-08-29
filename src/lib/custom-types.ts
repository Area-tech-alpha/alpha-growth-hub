import type {
  Lead as PrismaLead,
  Auction as PrismaAuction,
  Bid as PrismaBid,
  User as PrismaUser,
  AuthUser as PrismaAuthUser,
} from "@prisma/client";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  creditBalance: number;
}
export interface AuctionWithLead extends PrismaAuction {
  leads: PrismaLead;
  bidders?: number;
  currentBid?: number;
}

export interface PurchasedLead {
  purchaseDate: Date;
  purchasePrice: number;
  lead: PrismaLead;
}

export interface BidWithUserName extends PrismaBid {
  user: {
    name: string | null;
  };
}

export interface AuctionRow {
  id: string;
  status: string;
  expired_at: string;
  lead_id: string;
}

export type LeadForAuction = PrismaLead & { expires_at: string };

export interface AuctionRecord extends Omit<PrismaAuction, "leadId"> {
  leads: PrismaLead;
}

export interface AuctionWithLeadUI extends Omit<PrismaAuction, "leadId"> {
  leads: LeadForAuction;
  [key: string]: unknown;
}
