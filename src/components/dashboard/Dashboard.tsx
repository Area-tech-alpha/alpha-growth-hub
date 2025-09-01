"use client";

import React, { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import LeiloesPanel from "@/components/dashboard/LeiloesPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag } from "react-icons/fi";
import type { AuctionWithLead } from "@/lib/custom-types";

export default function Dashboard({
    initialAuctions,
    initialPurchasedLeads
}: {
    initialAuctions: AuctionRecord[],
    initialPurchasedLeads: LeadForAuction[]
}) {
    const supabase = createClient();
    const { data: session } = useSession();
    const userIdRef = useRef<string | undefined>(undefined);
    const bidsByAuctionRef = useRef<Record<string, { userId: string; id: string }[]>>({});

    useEffect(() => {
        userIdRef.current = session?.user?.id;
    }, [session?.user?.id]);

    useEffect(() => {
        // Subscribe globally to auctions updates and bids inserts to drive global toasts
        const channel = supabase
            .channel('dashboard-global-auctions')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, (payload: { new: { id: string; auction_id: string; user_id: string } }) => {
                const row = payload.new;
                const list = bidsByAuctionRef.current[row.auction_id] || [];
                // Keep a small record of bidders per auction
                if (!list.some(b => b.id === row.id)) {
                    bidsByAuctionRef.current[row.auction_id] = [{ id: row.id as string, userId: row.user_id as string }, ...list].slice(0, 100);
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions' }, (payload: { new: { id: string; status: string; winning_bid_id?: string | null } }) => {
                const updated = payload.new;
                if (updated.status === 'open') return;
                const userId = userIdRef.current;
                if (!userId) return;
                const auctionBids = bidsByAuctionRef.current[updated.id] || [];
                if (updated.status === 'closed_won') {
                    const winningBidId = updated.winning_bid_id as string | null;
                    if (winningBidId) {
                        const winningBid = auctionBids.find(b => b.id === winningBidId);
                        if (winningBid && winningBid.userId === userId) {
                            toast.success('Parabéns! Você ganhou o leilão!', { description: 'Veja o lead em Meus Leads.' });
                        } else if (auctionBids.some(b => b.userId === userId)) {
                            toast('Leilão encerrado', { description: 'Outro usuário venceu. Seus créditos retornaram.' });
                        }
                    }
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase]);
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Tabs defaultValue="leiloes" className="w-full">
                <TabsList className="pb-3 px-4 mt-2 w-full justify-center sm:justify-start">
                    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start [--tab-row-gap:0.5rem]">
                        <TabsTrigger value="creditos" className="flex items-center gap-2">
                            <CiCreditCard1 className="size-4" />
                            Créditos
                        </TabsTrigger>
                        <TabsTrigger value="meus-leads" className="flex items-center gap-2">
                            <FiShoppingBag className="size-4" />
                            Meus Leads
                        </TabsTrigger>
                        <TabsTrigger value="leiloes" className="flex items-center gap-2">
                            <IoMdTrendingUp className="size-4" />
                            Leilões
                        </TabsTrigger>
                    </div>
                </TabsList>
                <TabsContent value="creditos">
                    <CreditosPanel />
                </TabsContent>
                <TabsContent value="meus-leads">
                    <MeusLeadsPanel initialPurchasedLeads={initialPurchasedLeads} />
                </TabsContent>
                <TabsContent value="leiloes">
                    <LeiloesPanel initialAuctions={initialAuctions} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
