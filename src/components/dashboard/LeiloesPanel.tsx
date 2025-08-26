"use client";

import React from "react";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import { Lead } from "./leads/types";
import { LeadCard } from "./leiloes/LeadCard";
import { AuctionModal } from "./leiloes/AuctionModal";

const mockLeads: Lead[] = [
    {
        id: '1',
        title: 'Lead Imobiliário Premium',
        description: 'Cliente interessado em apartamento de 3 quartos na Barra da Tijuca, orçamento até R$ 800.000',
        category: 'Imobiliário',
        value: 1500,
        location: 'Rio de Janeiro - RJ',
        timeLeft: 480,
        currentBid: 120,
        minimumBid: 50,
        bidders: 5,
        status: 'active',
        tags: ['Premium', 'Apartamento', 'Barra da Tijuca'],

        // Informações completas do lead
        revenue: 2500000, // R$ 2.5M
        marketingInvestment: 150000, // R$ 150k
        companyName: 'Construtora Alpha Ltda',
        contactName: 'Maria Silva Santos',
        phone: '(21) 99999-8888',
        email: 'maria.silva@alphaconstrutora.com.br',
        niche: 'Construção Civil',
        channel: 'Meta Ads',

        // Dados mascarados
        maskedCompanyName: 'Construtora ******* Ltda',
        maskedContactName: 'Maria ****** Santos',
        maskedPhone: '(21) ****-8888',
        maskedEmail: 'm****@*****.com.br',

        contact: {
            name: 'Maria Silva Santos',
            phone: '(21) 99999-8888'
        }
    },
    {
        id: '2',
        title: 'Lead Seguro de Vida',
        description: 'Executivo de 35 anos interessado em seguro de vida com cobertura de R$ 500.000',
        category: 'Seguros',
        value: 800,
        location: 'São Paulo - SP',
        timeLeft: 180,
        currentBid: 85,
        minimumBid: 30,
        bidders: 8,
        status: 'ending_soon',
        tags: ['Executivo', 'Seguro de Vida', 'Alta Renda'],

        revenue: 850000,
        marketingInvestment: 45000,
        companyName: 'Tech Solutions Brasil S.A.',
        contactName: 'João Carlos Pereira',
        phone: '(11) 98765-4321',
        email: 'joao.pereira@techsolutions.com.br',
        niche: 'Tecnologia',
        channel: 'Google Ads',

        maskedCompanyName: 'Tech ******** Brasil S.A.',
        maskedContactName: 'João ****** Pereira',
        maskedPhone: '(11) ****-4321',
        maskedEmail: 'j****@*****.com.br',

        contact: {
            name: 'João Carlos Pereira',
            email: 'joao.pereira@techsolutions.com.br'
        }
    },
    {
        id: '3',
        title: 'Lead Financiamento Veicular',
        description: 'Casal jovem interessado em financiar SUV 0km, entrada de R$ 30.000',
        category: 'Financiamento',
        value: 600,
        location: 'Brasília - DF',
        timeLeft: 600,
        currentBid: 45,
        minimumBid: 25,
        bidders: 3,
        status: 'active',
        tags: ['SUV', 'Financiamento', 'Casal Jovem'],

        revenue: 120000,
        marketingInvestment: 8000,
        companyName: 'Oliveira & Associados ME',
        contactName: 'Ana Carolina Oliveira',
        phone: '(61) 91234-5678',
        email: 'ana.oliveira@oliveiraassoc.com.br',
        niche: 'Consultoria',
        channel: 'Meta Ads',

        maskedCompanyName: 'Oliveira & ********** ME',
        maskedContactName: 'Ana ******** Oliveira',
        maskedPhone: '(61) ****-5678',
        maskedEmail: 'a****@*****.com.br',

        contact: {
            name: 'Ana Carolina Oliveira'
        }
    }
];

export default function LeiloesPanel() {
    const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
    const user = { id: "current-user", name: "Você" };
    const totalValue = mockLeads.reduce((sum, lead) => sum + lead.value, 0);
    const activeAuctions = mockLeads.filter(lead => lead.status === 'active').length;

    return (
        <>
            {/* Stats Cards */}
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
                    contentTitle={totalValue.toString()}
                    contentDescription="em leads disponíveis"
                />
                <StatsCards
                    title="Participantes"
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                    contentTitle={mockLeads.reduce((sum, lead) => sum + lead.bidders, 0).toString()}
                    contentDescription="lances realizados"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {mockLeads.map((lead) => (
                    <LeadCard
                        key={lead.id}
                        lead={lead}
                        onSelect={() => setSelectedLead(lead)}
                    />
                ))}
            </div>

            {mockLeads.length === 0 && (
                <div className="text-center py-12">
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


