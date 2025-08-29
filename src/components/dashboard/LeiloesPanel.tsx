"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveAuctions } from "@/lib/api";
import { AuctionModal } from "./leiloes/AuctionModal";
import { LeadCard } from "./leiloes/LeadCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuctionWithLead } from "@/lib/custom-types";
export default function LeiloesPanel({
  userCredits,
  initialAuctions,
}: {
  userCredits: number;
  initialAuctions: AuctionWithLead[];
}) {
  const [selectedAuction, setSelectedAuction] =
    useState<AuctionWithLead | null>(null);

  const {
    data: activeAuctions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["activeAuctions"],
    queryFn: fetchActiveAuctions,
    initialData: initialAuctions,
  });

  if (isLoading && (!initialAuctions || initialAuctions.length === 0)) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-10 text-red-500">
        Falha ao carregar os leilões.
      </div>
    );
  }

  return (
    <>
      {activeAuctions && activeAuctions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeAuctions.map((auction) => (
            <LeadCard
              key={auction.id}
              auction={auction}
              onSelect={() => setSelectedAuction(auction)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">
            Nenhum leilão ativo no momento.
          </p>
        </div>
      )}

      {selectedAuction && (
        <AuctionModal
          auction={selectedAuction}
          userCredits={userCredits}
          onClose={() => setSelectedAuction(null)}
        />
      )}
    </>
  );
}
