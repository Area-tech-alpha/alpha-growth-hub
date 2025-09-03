import { create } from 'zustand'
import type { AuctionWithLead, Bid } from '@/components/dashboard/leiloes/types'
import type { Lead } from '@/components/dashboard/leads/types'
import { createClient } from '@/utils/supabase/client'

export interface RealtimeState {
    activeAuctions: AuctionWithLead[];
    bidsByAuction: Record<string, Bid[]>;
    purchasedLeads: Lead[];
    userCredits: number;

    setInitialAuctions: (auctions: AuctionWithLead[]) => void;
    setInitialPurchasedLeads: (leads: Lead[]) => void;

    upsertAuctionWithLead: (auction: AuctionWithLead) => void;
    updateAuctionFields: (auctionId: string, fields: Partial<AuctionWithLead>) => void;
    removeAuctionById: (auctionId: string) => void;

    addBidForAuction: (auctionId: string, bid: Bid) => void;
    setBidsForAuction: (auctionId: string, bids: Bid[]) => void;
    updateAuctionStatsFromBid: (auctionId: string, amount: number) => void;

    addPurchasedLeadIfMissing: (lead: Lead) => void;

    setUserCredits: (credits: number) => void;
    subscribeToUserCredits: (userId: string) => void;
    unsubscribeFromUserCredits: () => void;
}

const supabase = createClient();
let userCreditsChannel: ReturnType<typeof supabase.channel> | null = null;
let subscribedUserId: string | null = null;

export const useRealtimeStore = create<RealtimeState>()((set) => ({
    activeAuctions: [],
    bidsByAuction: {},
    purchasedLeads: [],
    userCredits: 0,

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
    }),

    setUserCredits: (credits: number) => set({ userCredits: credits }),

    subscribeToUserCredits: (userId: string) => {
        if (!userId) return;
        if (subscribedUserId === userId && userCreditsChannel) return;

        // Tear down previous subscription if switching users
        if (userCreditsChannel) {
            try {
                console.log('[Store] Unsubscribing previous user credits channel', { subscribedUserId });
                supabase.removeChannel(userCreditsChannel);
            } catch { }
            userCreditsChannel = null;
            subscribedUserId = null;
        }

        const channelName = `users-credits-${userId}`;
        console.log('[Store] Subscribing user credits channel', { channelName, userId });
        userCreditsChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
                (payload: { new?: { credit_balance?: number | string } }) => {
                    const raw = (payload?.new as unknown as { credit_balance?: number | string })?.credit_balance;
                    const parsed = typeof raw === 'string' ? parseFloat(raw) : (raw ?? 0);
                    const next = Number.isFinite(parsed as number) ? Number(parsed) : 0;
                    console.log('[Store] Realtime users.credit_balance UPDATE', { next });
                    set({ userCredits: next });
                }
            )
            .subscribe((status) => {
                console.log('[Store] users credits channel status:', status);
            });
        subscribedUserId = userId;

        // Seed with initial value
        supabase
            .from('users')
            .select('credit_balance')
            .eq('id', userId)
            .single()
            .then(({ data, error }) => {
                if (error) {
                    console.warn('[Store] Failed to fetch initial credit_balance', { error: error.message });
                    return;
                }
                const raw = (data as unknown as { credit_balance?: number | string })?.credit_balance;
                const parsed = typeof raw === 'string' ? parseFloat(raw) : (raw ?? 0);
                const next = Number.isFinite(parsed as number) ? Number(parsed) : 0;
                set({ userCredits: next });
            });
    },

    unsubscribeFromUserCredits: () => {
        if (userCreditsChannel) {
            try {
                console.log('[Store] Unsubscribing user credits channel', { subscribedUserId });
                supabase.removeChannel(userCreditsChannel);
            } catch { }
            userCreditsChannel = null;
            subscribedUserId = null;
        }
    }
}));


