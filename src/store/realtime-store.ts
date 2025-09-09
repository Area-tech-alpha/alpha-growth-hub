import { create } from 'zustand';
import type { AuctionWithLead, Bid, LeadForAuction } from '@/components/dashboard/leiloes/types';
import type { Lead } from '@/components/dashboard/leads/types';
import { createClient } from '@/utils/supabase/client';

export interface RealtimeState {
    activeAuctions: AuctionWithLead[];
    bidsByAuction: Record<string, Bid[]>;
    purchasedLeads: Lead[];
    userCredits: number;
    rawUserCredits: number;
    heldCredits: number;

    demoModeActive: boolean;
    demoCredits: number;
    demoHolds: Record<string, number>;
    setDemoModeActive: (active: boolean) => void;
    setDemoCredits: (amount: number) => void;
    setDemoHold: (auctionId: string, amount: number) => void;
    releaseDemoHold: (auctionId: string) => void;
    clearDemoMode: () => void;

    setInitialAuctions: (auctions: AuctionWithLead[]) => void;
    setInitialPurchasedLeads: (leads: Lead[]) => void;

    upsertAuctionWithLead: (auction: AuctionWithLead) => void;
    updateAuctionFields: (auctionId: string, fields: Partial<Omit<AuctionWithLead, 'leads'>> & { leads?: Partial<LeadForAuction> }) => void;
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

    setHeldCredits: (amount: number) => void;
    subscribeToUserCreditHolds: (userId: string) => void;
    unsubscribeFromUserCreditHolds: () => void;
    fetchAndSetUserActiveHoldsTotal: (userId: string) => Promise<void>;

    userPurchases: Array<{ id: string | number; created_at: string; amount_credits?: number; credits_purchased?: number; amount_paid?: number; status?: string;[key: string]: unknown }>;
    setUserPurchases: (rows: Array<{ id: string | number; created_at: string;[key: string]: unknown }>) => void;
    fetchLatestUserPurchases: (params: { userId: string; limit?: number }) => Promise<void>;
    subscribeToUserPurchases: (params: { userId: string }) => void;
    unsubscribeFromUserPurchases: () => void;
}

const supabase = createClient();
let userCreditsChannel: ReturnType<typeof supabase.channel> | null = null;
let creditHoldsChannel: ReturnType<typeof supabase.channel> | null = null;
let subscribedKey: string | null = null;
let holdsSubscribedKey: string | null = null;
let purchasesChannel: ReturnType<typeof supabase.channel> | null = null;
let purchasesSubscribedKey: string | null = null;
let leadsChannel: ReturnType<typeof supabase.channel> | null = null;
let leadsSubscribedKey: string | null = null;


export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
    activeAuctions: [],
    bidsByAuction: {},
    purchasedLeads: [],
    userCredits: 0,
    rawUserCredits: 0,
    heldCredits: 0,

    demoModeActive: false,
    demoCredits: 5000,
    demoHolds: {},
    setDemoModeActive: (active: boolean) => set({ demoModeActive: active }),
    setDemoCredits: (amount: number) => set({ demoCredits: Math.max(0, Number(amount) || 0) }),
    setDemoHold: (auctionId: string, amount: number) => set((state: RealtimeState) => ({
        demoHolds: { ...state.demoHolds, [auctionId]: Math.max(0, Number(amount) || 0) }
    })),
    releaseDemoHold: (auctionId: string) => set((state: RealtimeState) => {
        const nextHolds = { ...state.demoHolds };
        delete nextHolds[auctionId];
        return { demoHolds: nextHolds };
    }),
    clearDemoMode: () => set({ demoModeActive: false, demoCredits: 0, demoHolds: {} }),

    setInitialAuctions: (auctions: AuctionWithLead[]) => set({ activeAuctions: auctions }),
    setInitialPurchasedLeads: (leads: Lead[]) => set({ purchasedLeads: leads }),

    upsertAuctionWithLead: (auction: AuctionWithLead) => set((state: RealtimeState) => {
        const exists = state.activeAuctions.some(a => a.id === auction.id);
        return {
            activeAuctions: exists
                ? state.activeAuctions.map(a => a.id === auction.id ? { ...a, ...auction } : a)
                : [auction, ...state.activeAuctions]
        };
    }),

    updateAuctionFields: (auctionId: string, fields: Partial<Omit<AuctionWithLead, 'leads'>> & { leads?: Partial<LeadForAuction> }) => set((state: RealtimeState) => {
        return {
            activeAuctions: state.activeAuctions.map(a => {
                if (a.id !== auctionId) return a;
                const next: AuctionWithLead = { ...a, ...fields } as AuctionWithLead;
                // Se o expired_at mudar, refletimos no leads.expires_at para o CountdownTimer
                if (typeof fields.expired_at === 'string' && (a as { leads?: { expires_at?: string } }).leads) {
                    next.leads = { ...(a.leads as Record<string, unknown>), expires_at: fields.expired_at } as unknown as typeof a.leads;
                }
                // Se vier um merge parcial de leads, aplicamos profundo
                if (fields.leads && typeof fields.leads === 'object') {
                    next.leads = { ...(a.leads as Record<string, unknown>), ...(fields.leads as Record<string, unknown>) } as unknown as typeof a.leads;
                }
                return next;
            })
        };
    }),

    removeAuctionById: (auctionId: string) => set((state: RealtimeState) => {
        return {
            activeAuctions: state.activeAuctions.filter(a => a.id !== auctionId)
        };
    }),

    addBidForAuction: (auctionId: string, bid: Bid) => set((state: RealtimeState) => {
        const list = state.bidsByAuction[auctionId] || [];
        if (list.some(b => b.id === bid.id)) return {};
        return { bidsByAuction: { ...state.bidsByAuction, [auctionId]: [bid, ...list] } };
    }),

    setBidsForAuction: (auctionId: string, bids: Bid[]) => set((state: RealtimeState) => {
        return {
            bidsByAuction: { ...state.bidsByAuction, [auctionId]: bids }
        };
    }),

    updateAuctionStatsFromBid: (auctionId: string, amount: number) => set((state: RealtimeState) => {
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
        if (exists) return {};
        return { purchasedLeads: [lead, ...state.purchasedLeads] };
    }),

    fetchUserLeads: async (userId: string, limit: number = 100) => {
        if (!userId) return;
        const rpc = await supabase.rpc('get_user_leads', { p_user_id: userId, p_limit: limit });
        if (!rpc.error && Array.isArray(rpc.data)) {
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
        set({ purchasedLeads: (data as unknown as Lead[]) || [] });
    },

    subscribeToUserLeads: (userId: string) => {
        const nextKey = userId || null;
        if (!nextKey) return;
        if (leadsSubscribedKey === nextKey && leadsChannel) return;

        if (leadsChannel) {
            try {
                supabase.removeChannel(leadsChannel);
            } catch { }
            leadsChannel = null;
            leadsSubscribedKey = null;
        }

        const channelName = `leads_user_${userId}`;
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
            .subscribe();
        leadsSubscribedKey = nextKey;
    },

    unsubscribeFromUserLeads: () => {
        if (leadsChannel) {
            try {
                supabase.removeChannel(leadsChannel);
            } catch { }
            leadsChannel = null;
            leadsSubscribedKey = null;
        }
    },

    setUserCredits: (credits: number) => set((state) => ({
        rawUserCredits: credits,
        userCredits: Math.max(0, Number(credits) - Number(state.heldCredits || 0))
    })),

    subscribeToUserCredits: (userId: string) => {
        const nextKey = userId ? `id:${userId}` : null;
        if (!nextKey) return;
        if (subscribedKey === nextKey && userCreditsChannel) return;

        if (userCreditsChannel) {
            try {
                supabase.removeChannel(userCreditsChannel);
            } catch { }
            userCreditsChannel = null;
            subscribedKey = null;
        }

        const channelName = `users-credits-id-${userId}`;
        userCreditsChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
                (payload: { new?: { credit_balance?: number | string } }) => {
                    const raw = (payload?.new as unknown as { credit_balance?: number | string })?.credit_balance;
                    const parsed = typeof raw === 'string' ? parseFloat(raw) : (raw ?? 0);
                    const next = Number.isFinite(parsed as number) ? Number(parsed) : 0;
                    set((state: RealtimeState) => ({
                        rawUserCredits: next,
                        userCredits: Math.max(0, Number(next) - Number(state.heldCredits || 0))
                    }));
                }
            )
            .subscribe();
        subscribedKey = nextKey;

        supabase
            .rpc('get_user_credit_balance', { p_user_id: userId })
            .then(({ data, error }) => {
                if (error) {
                    console.warn('[Store] Failed to fetch initial credit_balance via RPC', { message: error.message, userId });
                    return;
                }
                const next = Number(data ?? 0);
                set((state: RealtimeState) => ({
                    rawUserCredits: Number.isFinite(next) ? Number(next) : 0,
                    userCredits: Math.max(0, Number.isFinite(next) ? Number(next) : 0 - Number(state.heldCredits || 0))
                }));
            });

        get().subscribeToUserCreditHolds(userId);
    },

    unsubscribeFromUserCredits: () => {
        if (userCreditsChannel) {
            try {
                supabase.removeChannel(userCreditsChannel);
            } catch { }
            userCreditsChannel = null;
            subscribedKey = null;
        }
    },

    setHeldCredits: (amount: number) => set((state: RealtimeState) => ({
        heldCredits: Number(amount) || 0,
        userCredits: Math.max(0, Number(state.rawUserCredits || 0) - (Number(amount) || 0))
    })),

    subscribeToUserCreditHolds: (userId: string) => {
        const nextKey = userId || null;
        if (!nextKey) return;
        if (holdsSubscribedKey === nextKey && creditHoldsChannel) return;

        if (creditHoldsChannel) {
            try {
                supabase.removeChannel(creditHoldsChannel);
            } catch { }
            creditHoldsChannel = null;
            holdsSubscribedKey = null;
        }

        const channelName = `credit_holds_user_${userId}`;
        creditHoldsChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'credit_holds', filter: `user_id=eq.${userId}` },
                () => {
                    get().fetchAndSetUserActiveHoldsTotal(userId);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'credit_holds', filter: `user_id=eq.${userId}` },
                () => {
                    get().fetchAndSetUserActiveHoldsTotal(userId);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'credit_holds', filter: `user_id=eq.${userId}` },
                () => {
                    get().fetchAndSetUserActiveHoldsTotal(userId);
                }
            )
            .subscribe();
        holdsSubscribedKey = nextKey;

        get().fetchAndSetUserActiveHoldsTotal(userId);
    },

    unsubscribeFromUserCreditHolds: () => {
        if (creditHoldsChannel) {
            try {
                supabase.removeChannel(creditHoldsChannel);
            } catch { }
            creditHoldsChannel = null;
            holdsSubscribedKey = null;
        }
    },

    fetchAndSetUserActiveHoldsTotal: async (userId: string) => {
        try {
            const rpc = await supabase.rpc('get_user_active_credit_holds', { p_user_id: userId });
            if (!rpc.error && typeof rpc.data !== 'undefined') {
                const sum = Number(rpc.data || 0);
                set((state: RealtimeState) => ({
                    heldCredits: sum,
                    userCredits: Math.max(0, Number(state.rawUserCredits || 0) - Number(sum || 0))
                }));
                return;
            }
            if (rpc.error) {
                console.warn('[Store] RPC get_user_active_credit_holds failed, fallback SELECT', { message: rpc.error.message });
            }
        } catch { }

        const { data, error } = await supabase
            .from('credit_holds')
            .select('amount, status, auctions!inner(status)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .eq('auctions.status', 'open');
        if (error) {
            console.warn('[Store] Failed to fetch active holds via SELECT', { message: error.message });
            return;
        }
        const sum = (data || []).reduce((acc, row: { amount: number | string }) => acc + (typeof row.amount === 'string' ? parseFloat(row.amount) : Number(row.amount || 0)), 0);
        set((state: RealtimeState) => ({
            heldCredits: sum,
            userCredits: Math.max(0, Number(state.rawUserCredits || 0) - Number(sum || 0))
        }));
    },

    userPurchases: [],
    setUserPurchases: (rows) => set({ userPurchases: rows }),

    fetchLatestUserPurchases: async ({ userId, limit = 5 }: { userId: string; limit?: number }) => {
        if (!userId) {
            console.warn('[Store] fetchLatestUserPurchases requires a userId.');
            return;
        }
        const rpcRes = await supabase.rpc('get_user_credit_transactions', { p_user_id: userId, p_limit: limit });
        if (!rpcRes.error && Array.isArray(rpcRes.data)) {
            set({ userPurchases: (rpcRes.data as Array<{ id: string | number; created_at: string;[key: string]: unknown }>) });
            return;
        }
        if (rpcRes.error) {
            console.warn('[Store] RPC get_user_credit_transactions failed, falling back to SELECT', { message: rpcRes.error.message });
        }
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
        set({ userPurchases: ((data || []) as Array<{ id: string | number; created_at: string;[key: string]: unknown }>) });
    },

    subscribeToUserPurchases: ({ userId }: { userId: string }) => {
        const nextKey = userId;
        if (!userId) {
            console.warn('[Store] subscribeToUserPurchases requires a userId.');
            return;
        }
        if (purchasesSubscribedKey === nextKey && purchasesChannel) return;

        if (purchasesChannel) {
            try {
                supabase.removeChannel(purchasesChannel);
            } catch { }
            purchasesChannel = null;
            purchasesSubscribedKey = null;
        }

        const channelName = `credit_transactions_user_${userId}`;
        purchasesChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'credit_transactions', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const row = payload?.new as { id?: string | number } & Record<string, unknown>;
                    if (!row?.id) return;
                    const current = get().userPurchases || [];
                    if (current.some(p => p.id === row.id)) return;
                    set({ userPurchases: [row as { id: string | number; created_at: string;[key: string]: unknown }, ...current] });
                }
            )
            .subscribe();
        purchasesSubscribedKey = nextKey;
    },

    unsubscribeFromUserPurchases: () => {
        if (purchasesChannel) {
            try {
                supabase.removeChannel(purchasesChannel);
            } catch { }
            purchasesChannel = null;
            purchasesSubscribedKey = null;
        }
    }
}));
