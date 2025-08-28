"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { createClient } from "@/utils/supabase/client";
import { FiShoppingBag } from "react-icons/fi";
import { PurchasedLeadCard } from "./leads/PurchasedLeadCard";
import type { Lead } from "./leads/types";

const supabase = createClient();

export default function MeusLeadsPanel({ initialPurchasedLeads }: { initialPurchasedLeads: Lead[] }) {
    const { data: session } = useSession();
    const [purchasedLeads, setPurchasedLeads] = useState(initialPurchasedLeads);

    useEffect(() => {
        if (!session?.user?.id) return;

        const channel = supabase
            .channel('purchased-leads-channel')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'leads',
                    filter: `owner_id=eq.${session.user.id}`
                },
                (payload) => {
                    console.log('Você comprou um novo lead!', payload.new);
                    const newPurchasedLead = payload.new as Lead;

                    setPurchasedLeads(prevLeads => {
                        if (prevLeads.some(lead => lead.id === newPurchasedLead.id)) {
                            return prevLeads;
                        }
                        return [newPurchasedLead, ...prevLeads];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    return (
        <>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Meus Leads Comprados</h2>
                    <p className="text-muted-foreground">Leads que você adquiriu nos leilões com informações completas</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">{purchasedLeads.length}</div>
                    <div className="text-sm text-muted-foreground">leads comprados</div>
                </div>
            </div>
            {purchasedLeads.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    {purchasedLeads.map((purchasedLead) => (
                        <PurchasedLeadCard
                            key={purchasedLead.id}
                            lead={purchasedLead}
                            purchaseDate={new Date((purchasedLead.updated_at as string) || purchasedLead.expires_at)}
                            purchasePrice={purchasedLead.currentBid}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <FiShoppingBag className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <div className="text-muted-foreground text-lg mb-2">Nenhum lead comprado ainda</div>
                    <p className="text-muted-foreground">Participe dos leilões para adquirir leads qualificados</p>
                </div>
            )}
        </>
    );
}
