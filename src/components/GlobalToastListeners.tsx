"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { createClient } from "@/utils/supabase/client";
import { ToastBus } from "@/lib/toastBus";

export default function GlobalToastListeners() {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const supabase = createClient();
    const timeoutsRef = useRef<Record<string, number>>({});

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel("global-toasts")
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auctions' }, async (payload: { new: { id: string; lead_id: string } }) => {
                try {
                    const leadId = payload?.new?.lead_id;
                    let name: string | undefined = undefined;
                    if (leadId) {
                        const { data: lead } = await supabase.from('leads').select('company_name, contact_name').eq('id', leadId).single();
                        name = (lead?.company_name as string) || (lead?.contact_name as string) || undefined;
                    }
                    ToastBus.notifyNewAuction(payload.new.id, name);
                } catch { }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions' }, async (payload: { new: { id: string; status: string; winning_bid_id?: string | null } }) => {
                const updated = payload?.new;
                if (!updated?.id) return;
                if (updated.status === 'open') return;
                try {
                    const { data: myBidAny } = await supabase.from('bids').select('id').eq('auction_id', updated.id).eq('user_id', userId).limit(1);
                    const participated = Array.isArray(myBidAny) && myBidAny.length > 0;
                    if (!participated) return;

                    if (updated.status === 'closed_won' && updated.winning_bid_id) {
                        const { data: winBid } = await supabase.from('bids').select('user_id').eq('id', updated.winning_bid_id).single();
                        if (winBid?.user_id === userId) {
                            ToastBus.notifyAuctionWon(updated.id);
                        } else {
                            ToastBus.notifyAuctionLost(updated.id);
                        }
                    } else if (updated.status === 'closed_expired') {
                        ToastBus.notifyAuctionLost(updated.id);
                    }
                } catch { }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, async (payload: { new: { id: string; auction_id: string; user_id: string; amount: number | string } }) => {
                const row = payload?.new;
                if (!row?.auction_id) return;
                if (row.user_id === userId) {
                    try {
                        if (!timeoutsRef.current[row.auction_id]) {
                            const { data: a } = await supabase.from('auctions').select('expired_at').eq('id', row.auction_id).single();
                            const expiresAt = a?.expired_at ? new Date(a.expired_at).getTime() : 0;
                            const ms = expiresAt - Date.now() - 60_000;
                            if (ms > 0 && Number.isFinite(ms)) {
                                const tid = window.setTimeout(() => {
                                    ToastBus.notifyAuctionEndingSoon(row.auction_id, 60);
                                    delete timeoutsRef.current[row.auction_id];
                                }, ms);
                                timeoutsRef.current[row.auction_id] = tid as unknown as number;
                            }
                        }
                    } catch { }
                    return;
                }
                try {
                    const { data: myBidAny } = await supabase.from('bids').select('id').eq('auction_id', row.auction_id).eq('user_id', userId).limit(1);
                    const participated = Array.isArray(myBidAny) && myBidAny.length > 0;
                    if (!participated) return;
                    const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount;
                    ToastBus.notifyNewBidOnParticipatingAuction(row.auction_id, amount);
                } catch { }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, supabase]);

    return null;
}


