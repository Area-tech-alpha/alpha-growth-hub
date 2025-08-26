"use client";

import React from "react";
import { FiShoppingBag } from "react-icons/fi";
import { PurchasedLeadCard } from "./leads/PurchasedLeadCard";
import { PurchasedLead } from "./leads/types";

const mockPurchasedLeads: PurchasedLead[] = [
    {
        lead: {
            id: '4',
            title: 'Lead Empréstimo Empresarial',
            description: 'Empresa de médio porte buscando empréstimo de R$ 2M para expansão',
            category: 'Financiamento',
            value: 1200,
            location: 'São Paulo - SP',
            timeLeft: 0,
            currentBid: 250,
            minimumBid: 100,
            bidders: 12,
            status: 'closed',
            tags: ['Empréstimo', 'Médio Porte', 'Expansão'],

            revenue: 5200000,
            marketingInvestment: 85000,
            companyName: 'Indústria Beta Equipamentos Ltda',
            contactName: 'Carlos Eduardo Mendes',
            phone: '(11) 94567-1234',
            email: 'carlos.mendes@industriabeta.com.br',
            niche: 'Indústria',
            channel: 'Google Ads',

            maskedCompanyName: 'Indústria **** Equipamentos Ltda',
            maskedContactName: 'Carlos ******* Mendes',
            maskedPhone: '(11) ****-1234',
            maskedEmail: 'c****@*****.com.br',

            contact: {
                name: 'Carlos Eduardo Mendes',
                phone: '(11) 94567-1234',
                email: 'carlos.mendes@industriabeta.com.br'
            }
        },
        purchaseDate: new Date(2024, 11, 8, 14, 30),
        purchasePrice: 250
    },
    {
        lead: {
            id: '5',
            title: 'Lead Seguro Residencial',
            description: 'Família interessada em seguro residencial para casa de R$ 1,2M',
            category: 'Seguros',
            value: 400,
            location: 'Rio de Janeiro - RJ',
            timeLeft: 0,
            currentBid: 75,
            minimumBid: 40,
            bidders: 6,
            status: 'closed',
            tags: ['Residencial', 'Família', 'Alto Valor'],

            revenue: 320000,
            marketingInvestment: 22000,
            companyName: 'Gamma Consultoria Familiar',
            contactName: 'Patricia Ferreira Lima',
            phone: '(21) 97788-9900',
            email: 'patricia.lima@gammaconsult.com.br',
            niche: 'Consultoria',
            channel: 'Meta Ads',

            maskedCompanyName: 'Gamma ********** Familiar',
            maskedContactName: 'Patricia ******** Lima',
            maskedPhone: '(21) ****-9900',
            maskedEmail: 'p****@*****.com.br',

            contact: {
                name: 'Patricia Ferreira Lima',
                phone: '(21) 97788-9900',
                email: 'patricia.lima@gammaconsult.com.br'
            }
        },
        purchaseDate: new Date(2024, 11, 7, 16, 45),
        purchasePrice: 75
    }
];

export default function MeusLeadsPanel() {
    return (
        <>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Meus Leads Comprados</h2>
                    <p className="text-muted-foreground">Leads que você adquiriu nos leilões com informações completas</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">{mockPurchasedLeads.length}</div>
                    <div className="text-sm text-muted-foreground">leads comprados</div>
                </div>
            </div>
            {mockPurchasedLeads.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {mockPurchasedLeads.map((mockPurchasedLead) => (
                        <PurchasedLeadCard
                            key={mockPurchasedLead.lead.id}
                            lead={mockPurchasedLead.lead}
                            purchaseDate={mockPurchasedLead.purchaseDate}
                            purchasePrice={mockPurchasedLead.purchasePrice}
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


