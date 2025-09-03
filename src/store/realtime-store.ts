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
    subscribeToUserCreditsBy: (params: { userId?: string; email?: string }) => void;
    unsubscribeFromUserCredits: () => void;
}

const supabase = createClient();
let userCreditsChannel: ReturnType<typeof supabase.channel> | null = null;
let subscribedKey: string | null = null;

function isUuidLike(value?: string): boolean {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
        useRealtimeStore.getState().subscribeToUserCreditsBy({ userId });
    },

    subscribeToUserCreditsBy: ({ userId, email }: { userId?: string; email?: string }) => {
        const preferId = isUuidLike(userId);
        const filterField = preferId ? 'id' : (email ? 'email' : undefined);
        const filterValue = preferId ? (userId as string) : (email as string);
        const nextKey = filterField && filterValue ? `${filterField}:${filterValue}` : null;

        console.log('[Store] subscribeToUserCreditsBy invoked', { userId, email, preferId, filterField, filterValue, alreadySubscribed: subscribedKey === nextKey });
        if (!filterField || !filterValue) return;
        if (subscribedKey === nextKey && userCreditsChannel) return;

        // Tear down previous subscription if switching users
        if (userCreditsChannel) {
            try {
                console.log('[Store] Unsubscribing previous user credits channel', { subscribedKey });
                supabase.removeChannel(userCreditsChannel);
            } catch { }
            userCreditsChannel = null;
            subscribedKey = null;
        }

        const channelName = `users-credits-${filterField}-${filterValue}`;
        console.log('[Store] Subscribing user credits channel', { channelName, filterField, filterValue });
        userCreditsChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'users', filter: `${filterField}=eq.${filterValue}` },
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
        subscribedKey = nextKey;

        // Seed with initial value via internal API (avoids RLS/type mismatches)
        fetch('/api/me/credits')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data) return;
                const value = typeof data.creditBalance === 'string' ? parseFloat(data.creditBalance) : data.creditBalance;
                const next = Number.isFinite(value) ? Number(value) : 0;
                set({ userCredits: next });
            })
            .catch(() => { });
    },

    unsubscribeFromUserCredits: () => {
        if (userCreditsChannel) {
            try {
                console.log('[Store] Unsubscribing user credits channel', { subscribedKey });
                supabase.removeChannel(userCreditsChannel);
            } catch { }
            userCreditsChannel = null;
            subscribedKey = null;
        }
    }
}));


