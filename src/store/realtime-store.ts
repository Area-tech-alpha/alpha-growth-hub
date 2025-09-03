import { create } from 'zustand';
import type { AuctionWithLead, Bid } from '@/components/dashboard/leiloes/types';
import type { Lead } from '@/components/dashboard/leads/types';
import { createClient } from '@/utils/supabase/client';

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
    fetchUserLeads: (userId: string, limit?: number) => Promise<void>;
    subscribeToUserLeads: (userId: string) => void;
    unsubscribeFromUserLeads: () => void;

    setUserCredits: (credits: number) => void;
    subscribeToUserCredits: (userId: string) => void;
    unsubscribeFromUserCredits: () => void;

    // Credit purchases (history)
    userPurchases: Array<{ id: string | number; created_at: string; amount_credits?: number; credits_purchased?: number; amount_paid?: number; status?: string;[key: string]: unknown }>;
    setUserPurchases: (rows: Array<{ id: string | number; created_at: string;[key: string]: unknown }>) => void;
    fetchLatestUserPurchases: (params: { userId: string; limit?: number }) => Promise<void>;
    subscribeToUserPurchases: (params: { userId: string }) => void;
    unsubscribeFromUserPurchases: () => void;
}

const supabase = createClient();
let userCreditsChannel: ReturnType<typeof supabase.channel> | null = null;
let subscribedKey: string | null = null;
let purchasesChannel: ReturnType<typeof supabase.channel> | null = null;
let purchasesSubscribedKey: string | null = null;
let leadsChannel: ReturnType<typeof supabase.channel> | null = null;
let leadsSubscribedKey: string | null = null;


export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
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

    // Fetch purchased leads (owner_id = userId)
    fetchUserLeads: async (userId: string, limit: number = 100) => {
        if (!userId) return;
        console.log('[Store] Fetch user leads start', { userId, limit });
        // Try RPC first for RLS-friendly access if defined
        const rpc = await supabase.rpc('get_user_leads', { p_user_id: userId, p_limit: limit });
        if (!rpc.error && Array.isArray(rpc.data)) {
            console.log('[Store] Fetch user leads RPC rows', { count: rpc.data.length });
            set({ purchasedLeads: (rpc.data as unknown as Lead[]) || [] });
            return;
        }
        if (rpc.error) {
            console.warn('[Store] get_user_leads RPC failed, falling back to SELECT', { message: rpc.error.message });
        }
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('owner_id', userId)
            .order('updated_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.warn('[Store] Fetch user leads SELECT error', { message: error.message });
            return;
        }
        console.log('[Store] Fetch user leads SELECT rows', { count: (data || []).length });
        set({ purchasedLeads: (data as unknown as Lead[]) || [] });
    },

    // Subscribe to user leads changes
    subscribeToUserLeads: (userId: string) => {
        const nextKey = userId || null;
        if (!nextKey) return;
        if (leadsSubscribedKey === nextKey && leadsChannel) return;

        if (leadsChannel) {
            try {
                console.log('[Store] Unsubscribing previous leads channel', { leadsSubscribedKey });
                supabase.removeChannel(leadsChannel);
            } catch { }
            leadsChannel = null;
            leadsSubscribedKey = null;
        }

        const channelName = `leads_user_${userId}`;
        console.log('[Store] Subscribing leads channel', { channelName, userId });
        leadsChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'leads', filter: `owner_id=eq.${userId}` },
                (payload: { new: Lead }) => {
                    const row = payload?.new;
                    if (!row?.id) return;
                    set((state: RealtimeState) => {
                        const exists = state.purchasedLeads.some(l => l.id === row.id);
                        return { purchasedLeads: exists ? state.purchasedLeads : [row, ...state.purchasedLeads] };
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'leads', filter: `owner_id=eq.${userId}` },
                (payload: { new: Lead }) => {
                    const updated = payload?.new;
                    if (!updated?.id) return;
                    set((state: RealtimeState) => ({
                        purchasedLeads: state.purchasedLeads.some((l: Lead) => l.id === updated.id)
                            ? state.purchasedLeads.map((l: Lead) => (l.id === updated.id ? { ...l, ...updated } as Lead : l))
                            : [updated, ...state.purchasedLeads]
                    }));
                }
            )
            .subscribe((status) => {
                console.log('[Store] leads channel status:', status);
            });
        leadsSubscribedKey = nextKey;
    },

    unsubscribeFromUserLeads: () => {
        if (leadsChannel) {
            try {
                console.log('[Store] Unsubscribing leads channel', { leadsSubscribedKey });
                supabase.removeChannel(leadsChannel);
            } catch { }
            leadsChannel = null;
            leadsSubscribedKey = null;
        }
    },

    setUserCredits: (credits: number) => set({ userCredits: credits }),

    subscribeToUserCredits: (userId: string) => {
        const nextKey = userId ? `id:${userId}` : null;
        console.log('[Store] subscribeToUserCredits invoked', { userId, alreadySubscribed: subscribedKey === nextKey });
        if (!nextKey) return;
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

        const channelName = `users-credits-id-${userId}`;
        console.log('[Store] Subscribing user credits channel', { channelName, userId });
        userCreditsChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
                (payload: { new?: { credit_balance?: number | string } }) => {
                    console.log('[Store] Received UPDATE payload for users (credits)', payload);
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

        // Seed with initial value via Supabase (by id)
        console.log('[Store] Fetching initial credit_balance via RPC', { userId });
        supabase
            .rpc('get_user_credit_balance', { p_user_id: userId })
            .then(({ data, error }) => {
                if (error) {
                    console.warn('[Store] Failed to fetch initial credit_balance via RPC', { message: error.message, userId });
                    return;
                }
                const next = Number(data ?? 0);
                console.log('[Store] Setting initial userCredits (RPC)', { next });
                set({ userCredits: Number.isFinite(next) ? next : 0 });
            });
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
    },

    // Purchases (credit_transactions)
    userPurchases: [],
    setUserPurchases: (rows) => set({ userPurchases: rows }),

    // Buscar últimas transações via RPC (security definer), com fallback ao SELECT se a RPC não existir
    fetchLatestUserPurchases: async ({ userId, limit = 5 }: { userId: string; limit?: number }) => {
        console.log('[Store] fetchLatestUserPurchases invoked', { userId, limit });
        if (!userId) {
            console.warn('[Store] fetchLatestUserPurchases requires a userId.');
            return;
        }
        // Primeiro tenta RPC
        const rpcRes = await supabase.rpc('get_user_credit_transactions', { p_user_id: userId, p_limit: limit });
        if (!rpcRes.error && Array.isArray(rpcRes.data)) {
            console.log('[Store] fetchLatestUserPurchases RPC rows', { count: rpcRes.data.length });
            set({ userPurchases: (rpcRes.data as Array<{ id: string | number; created_at: string;[key: string]: unknown }>) });
            return;
        }
        if (rpcRes.error) {
            console.warn('[Store] RPC get_user_credit_transactions failed, falling back to SELECT', { message: rpcRes.error.message });
        }
        // Fallback SELECT
        const { data, error } = await supabase
            .from('credit_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.warn('[Store] fetchLatestUserPurchases SELECT error', { message: error.message });
            return;
        }
        console.log('[Store] fetchLatestUserPurchases SELECT rows', { count: (data || []).length });
        set({ userPurchases: ((data || []) as Array<{ id: string | number; created_at: string;[key: string]: unknown }>) });
    },

    // Assinatura realtime por userId (inserções)
    subscribeToUserPurchases: ({ userId }: { userId: string }) => {
        const nextKey = userId;
        if (!userId) {
            console.warn('[Store] subscribeToUserPurchases requires a userId.');
            return;
        }
        if (purchasesSubscribedKey === nextKey && purchasesChannel) return;

        if (purchasesChannel) {
            try {
                console.log('[Store] Unsubscribing previous purchases channel', { purchasesSubscribedKey });
                supabase.removeChannel(purchasesChannel);
            } catch { }
            purchasesChannel = null;
            purchasesSubscribedKey = null;
        }

        const channelName = `credit_transactions_user_${userId}`;
        console.log('[Store] Subscribing purchases channel', { channelName, userId });
        purchasesChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'credit_transactions', filter: `user_id=eq.${userId}` },
                (payload) => {
                    console.log('[Store] Realtime INSERT credit_transactions payload', payload);
                    const row = payload?.new as { id?: string | number } & Record<string, unknown>;
                    if (!row?.id) return;
                    const current = get().userPurchases || [];
                    if (current.some(p => p.id === row.id)) return;
                    set({ userPurchases: [row as { id: string | number; created_at: string;[key: string]: unknown }, ...current] });
                }
            )
            .subscribe((status) => {
                console.log('[Store] purchases channel status:', status);
            });
        purchasesSubscribedKey = nextKey;
    },

    unsubscribeFromUserPurchases: () => {
        if (purchasesChannel) {
            try {
                console.log('[Store] Unsubscribing purchases channel', { purchasesSubscribedKey });
                supabase.removeChannel(purchasesChannel);
            } catch { }
            purchasesChannel = null;
            purchasesSubscribedKey = null;
        }
    }
}));
