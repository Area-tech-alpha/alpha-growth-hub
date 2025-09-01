import { create } from 'zustand'
import type { AuctionWithLead, Bid } from '@/components/dashboard/leiloes/types'
import type { Lead } from '@/components/dashboard/leads/types'

export interface RealtimeState {
    activeAuctions: AuctionWithLead[];
    bidsByAuction: Record<string, Bid[]>;
    purchasedLeads: Lead[];

    setInitialAuctions: (auctions: AuctionWithLead[]) => void;
    setInitialPurchasedLeads: (leads: Lead[]) => void;

    upsertAuctionWithLead: (auction: AuctionWithLead) => void;
    updateAuctionFields: (auctionId: string, fields: Partial<AuctionWithLead>) => void;
    removeAuctionById: (auctionId: string) => void;

    addBidForAuction: (auctionId: string, bid: Bid) => void;
    setBidsForAuction: (auctionId: string, bids: Bid[]) => void;
    updateAuctionStatsFromBid: (auctionId: string, amount: number) => void;

    addPurchasedLeadIfMissing: (lead: Lead) => void;
}

export const useRealtimeStore = create<RealtimeState>()((set) => ({
    activeAuctions: [],
    bidsByAuction: {},
    purchasedLeads: [],

    setInitialAuctions: (auctions: AuctionWithLead[]) => set({ activeAuctions: auctions }),
    setInitialPurchasedLeads: (leads: Lead[]) => set({ purchasedLeads: leads }),

    upsertAuctionWithLead: (auction: AuctionWithLead) => set((state: RealtimeState) => {
        const exists = state.activeAuctions.some(a => a.id === auction.id);
        console.log('[Store] upsertAuctionWithLead', { id: auction.id, exists });
        return {
            activeAuctions: exists
                ? state.activeAuctions.map(a => a.id === auction.id ? { ...a, ...auction } : a)
                : [auction, ...state.activeAuctions]
        };
    }),

    updateAuctionFields: (auctionId: string, fields: Partial<AuctionWithLead>) => set((state: RealtimeState) => {
        console.log('[Store] updateAuctionFields', { auctionId, fields: Object.keys(fields || {}) });
        return {
            activeAuctions: state.activeAuctions.map(a => a.id === auctionId ? { ...a, ...fields } : a)
        };
    }),

    removeAuctionById: (auctionId: string) => set((state: RealtimeState) => {
        console.log('[Store] removeAuctionById', { auctionId });
        return {
            activeAuctions: state.activeAuctions.filter(a => a.id !== auctionId)
        };
    }),

    addBidForAuction: (auctionId: string, bid: Bid) => set((state: RealtimeState) => {
        const list = state.bidsByAuction[auctionId] || [];
        if (list.some(b => b.id === bid.id)) return {};
        console.log('[Store] addBidForAuction', { auctionId, bidId: bid.id, amount: bid.amount });
        return { bidsByAuction: { ...state.bidsByAuction, [auctionId]: [bid, ...list] } };
    }),

    setBidsForAuction: (auctionId: string, bids: Bid[]) => set((state: RealtimeState) => {
        console.log('[Store] setBidsForAuction', { auctionId, count: bids.length });
        return {
            bidsByAuction: { ...state.bidsByAuction, [auctionId]: bids }
        };
    }),

    updateAuctionStatsFromBid: (auctionId: string, amount: number) => set((state: RealtimeState) => {
        console.log('[Store] updateAuctionStatsFromBid', { auctionId, amount });
        return {
            activeAuctions: state.activeAuctions.map(a => {
                if (a.id !== auctionId) return a;
                const nextCurrent = Math.max(a.leads.currentBid || 0, amount || 0);
                const nextBidders = (a.leads.bidders || 0) + 1;
                return { ...a, leads: { ...a.leads, currentBid: nextCurrent, bidders: nextBidders } };
            })
        };
    }),

    addPurchasedLeadIfMissing: (lead: Lead) => set((state: RealtimeState) => {
        const exists = state.purchasedLeads.some(l => l.id === lead.id);
        console.log('[Store] addPurchasedLeadIfMissing', { id: lead.id, exists });
        if (exists) return {};
        return { purchasedLeads: [lead, ...state.purchasedLeads] };
    })
}));


