export interface Bid {
    id: string;
    leadId: string;
    userId: string;
    userName: string;
    amount: number;
    timestamp: Date;
}

import type { Lead } from "../leads/types";

export type AuctionKind = 'single' | 'batch'

export interface AuctionRow {
    id: string;
    status: string;
    expired_at: string;
    lead_id: string;
    type?: AuctionKind;
}

export interface AuctionRecord {
    id: string;
    status: string;
    expired_at: string;
    lead_id: string;
    type?: AuctionKind;
    minimum_bid?: number | string;
    leads: Lead;
}

export type LeadForAuction = Lead & { expires_at: string };

export interface BatchAuctionSummary {
    id: string;
    totalLeads: number;
    leadUnitPrice: number;
    minimumBid: number;
    status?: string;
    result?: string;
    leads: LeadForAuction[];
}

export interface AuctionWithLead {
    id: string;
    status: string;
    expired_at: string;
    minimum_bid?: number;
    type?: AuctionKind;
    batchSummary?: BatchAuctionSummary;
    leads: LeadForAuction;
    [key: string]: unknown;
}
