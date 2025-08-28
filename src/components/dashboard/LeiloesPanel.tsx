"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { sortLeads } from "@/lib/sortLeads";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import { LeadCard } from "./leiloes/LeadCard";
import { AuctionModal } from "./leiloes/AuctionModal";
import type { Lead as AuctionLead } from "./leads/types";
import { mockLeads } from "@/lib/mockLeads";

const supabase = createClient();

export default function LeiloesPanel({ initialLeads }: { initialLeads: AuctionLead[] }) {
    const [activeLeads, setActiveLeads] = useState<AuctionLead[]>(mockLeads);
    const [selectedLead, setSelectedLead] = useState<AuctionLead | null>(null);

    useEffect(() => {
        const channel = supabase
            .channel('realtime-leads')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'leads'
            }, (payload: { new: AuctionLead }) => {
                console.log('Novo lead recebido!', payload.new);
                const newLead = payload.new as AuctionLead;

                setActiveLeads(prevLeads => sortLeads([...prevLeads, newLead]));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleExpire = (leadId: string) => {
        setActiveLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId));
    };

    const user = { id: "current-user", name: "Você" };

    const totalValue = activeLeads.reduce((sum, lead) => sum + (lead.value as number || 0), 0);
    const activeAuctions = activeLeads.length;
    const totalBidders = activeLeads.reduce((sum, lead) => sum + (lead.bidders as number || 0), 0);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCards
                    title="Leilões Ativos"
                    icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                    contentTitle={activeAuctions.toString()}
                    contentDescription="leads disponíveis agora"
                />
                <StatsCards
                    title="Valor Total"
                    icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                    contentTitle={totalValue.toLocaleString('pt-BR')}
                    contentDescription="em leads disponíveis"
                />
                <StatsCards
                    title="Participantes"
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                    contentTitle={totalBidders.toString()}
                    contentDescription="lances realizados"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                {activeLeads.map((lead) => (
                    <LeadCard
                        key={lead.id}
                        lead={lead}
                        onExpire={() => handleExpire(lead.id)}
                        onSelect={() => setSelectedLead(lead)}
                    />
                ))}
            </div>

            {activeLeads.length === 0 && (
                <div className="text-center py-12 col-span-full">
                    <div className="text-gray-400 text-lg mb-2">Nenhum lead encontrado</div>
                    <p className="text-gray-500">Aguarde novos leilões</p>
                </div>
            )}
            {selectedLead && (
                <AuctionModal
                    lead={selectedLead}
                    user={user}
                    onClose={() => setSelectedLead(null)}
                />
            )}
        </>
    );
}
