"use client";

import React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import LeiloesPanel from "@/components/dashboard/LeiloesPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag } from "react-icons/fi";

export default function Dashboard() {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Tabs defaultValue="creditos" className="w-full">
                <TabsList className="sticky top-16 bg-background/80 backdrop-blur-sm z-40 pb-3">
                    <div className="flex items-center gap-2">
                        <TabsTrigger value="creditos" className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}>
                            <CiCreditCard1 className="size-4" />
                            Créditos
                        </TabsTrigger>
                        <TabsTrigger value="meus-leads" className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}>
                            <FiShoppingBag className="size-4" />
                            Meus Leads
                        </TabsTrigger>
                        <TabsTrigger value="leiloes" className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}>
                            <IoMdTrendingUp className="size-4" />
                            Leilões
                        </TabsTrigger>
                    </div>
                </TabsList>
                <TabsContent value="creditos">
                    <div className="grid gap-4">
                        <CreditosPanel />
                    </div>
                </TabsContent>
                <TabsContent value="meus-leads">
                    <div className="grid gap-4">
                        <MeusLeadsPanel />
                    </div>
                </TabsContent>
                <TabsContent value="leiloes">
                    <div className="grid gap-4">
                        <LeiloesPanel />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}