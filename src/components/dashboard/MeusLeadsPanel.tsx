"use client";

import { useEffect } from "react";
import { FiShoppingBag } from "react-icons/fi";
import { PurchasedLeadCard } from "./leads/PurchasedLeadCard";
import type { Lead } from "./leads/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";

export default function MeusLeadsPanel() {
    const purchasedLeads = useRealtimeStore((s: RealtimeState) => s.purchasedLeads) as Lead[];

    useEffect(() => {
        console.log('[MeusLeadsPanel] purchasedLeads length:', purchasedLeads.length);
        if (purchasedLeads.length > 0) {
            const first = purchasedLeads[0] as Lead & { owner_id?: string };
            console.log('[MeusLeadsPanel] first lead sample:', { id: first?.id, owner: first?.owner_id });
        }
    }, [purchasedLeads.length, purchasedLeads]);

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
