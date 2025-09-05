export interface Bid {
    id: string;
    leadId: string;
    userId: string;
    userName: string;
    amount: number;
    timestamp: Date;
}

import type { Lead } from "../leads/types";

export interface AuctionRow {
    id: string;
    status: string;
    expired_at: string;
    lead_id: string;
}

export interface AuctionRecord {
    id: string;
    status: string;
    expired_at: string;
    lead_id: string;
    minimum_bid?: number | string;
    leads: Lead;
}

export type LeadForAuction = Lead & { expires_at: string };

export interface AuctionWithLead {
    id: string;
    status: string;
    expired_at: string;
    minimum_bid?: number;
    leads: LeadForAuction;
    [key: string]: unknown;
}