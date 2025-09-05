export interface Bid {
    id: string;
    leadId: string;
    userId: string;
    userName: string;
    amount: number;
    timestamp: Date;
}

// Auction types used across dashboard
import type { Lead } from "../leads/types";

// Minimal row shape emitted by Supabase Realtime for the auctions table
export interface AuctionRow {
    id: string;
    status: string;
    expired_at: string;
    lead_id: string;
}

// Shape returned by the initial server query: auctions with nested lead
export interface AuctionRecord {
    id: string;
    status: string;
    expired_at: string;
    lead_id: string;
    minimum_bid?: number | string;
    leads: Lead; // nested lead from select('*, leads(*)')
}

// Lead used in auctions UI must include the auction expiration for timers
export type LeadForAuction = Lead & { expires_at: string };

// Normalized auction object used by the client components
export interface AuctionWithLead {
    id: string;
    status: string;
    expired_at: string;
    minimum_bid?: number;
    leads: LeadForAuction;
    [key: string]: unknown;
}