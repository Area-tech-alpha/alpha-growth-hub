"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPurchasedLeads } from "@/lib/api";
import { FiShoppingBag } from "react-icons/fi";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchasedLeadCard } from "./leads/PurchasedLeadCard";
import { PurchasedLead } from "@/lib/custom-types";

export default function MeusLeadsPanel() {
  const {
    data: purchasedLeads,
    isLoading,
    isError,
  } = useQuery<PurchasedLead[]>({
    queryKey: ["purchasedLeads"],
    queryFn: fetchPurchasedLeads,
  });

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="text-right">
            <Skeleton className="h-8 w-10 ml-auto" />
            <Skeleton className="h-4 w-24 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Falha ao carregar seus leads comprados.</p>
        <p>Por favor, tente recarregar a página.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Meus Leads Comprados
          </h2>
          <p className="text-muted-foreground">
            Leads que você adquiriu nos leilões com informações completas
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-yellow-600">
            {purchasedLeads?.length || 0}
          </div>
          <div className="text-sm text-muted-foreground">leads comprados</div>
        </div>
      </div>

      {purchasedLeads && purchasedLeads.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {purchasedLeads.map((purchasedLead) => (
            <PurchasedLeadCard
              key={purchasedLead.lead.id}
              lead={purchasedLead.lead}
              purchaseDate={new Date(purchasedLead.purchaseDate)}
              purchasePrice={purchasedLead.purchasePrice}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FiShoppingBag className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <div className="text-muted-foreground text-lg mb-2">
            Nenhum lead comprado ainda
          </div>
          <p className="text-muted-foreground">
            Participe dos leilões para adquirir leads qualificados
          </p>
        </div>
      )}
    </>
  );
}
