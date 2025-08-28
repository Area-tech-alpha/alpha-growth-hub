"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import LeiloesPanel from "@/components/dashboard/LeiloesPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag } from "react-icons/fi";
import type { Lead as AuctionLead } from "./leads/types";

export default function Dashboard({
    initialLeads,
    initialPurchasedLeads
}: {
    initialLeads: AuctionLead[],
    initialPurchasedLeads: AuctionLead[]
}) {
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
                    <LeiloesPanel initialLeads={initialLeads} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
