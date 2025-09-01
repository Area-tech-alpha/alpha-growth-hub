"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchActiveAuctions } from "@/lib/api";
import { AuctionModal } from "./leiloes/AuctionModal";
import { LeadCard } from "./leiloes/LeadCard";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import type { AuctionWithLead } from "@/lib/custom-types";
import { createClient } from "@/utils/supabase/client";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface AuctionPayload {
  id: string;
  status: "open" | "closed_won" | "closed_expired";
}

interface BidPayload {
  auction_id: string;
  amount: number;
}

const supabase = createClient();

export default function LeiloesPanel({
  userCredits,
  initialAuctions,
}: {
  userCredits: number;
  initialAuctions: AuctionWithLead[];
}) {
  const [activeAuctions, setActiveAuctions] = useState<AuctionWithLead[]>(
    initialAuctions || []
  );
  const [selectedAuction, setSelectedAuction] =
    useState<AuctionWithLead | null>(null);
  const queryClient = useQueryClient();

  const { data: fetchedAuctions } = useQuery({
    queryKey: ["activeAuctions"],
    queryFn: fetchActiveAuctions,
    initialData: initialAuctions,
  });

  useEffect(() => {
    if (fetchedAuctions) {
      setActiveAuctions(fetchedAuctions);
    }
  }, [fetchedAuctions]);

  useEffect(() => {
    const handleAuctionInsert = () => {
      queryClient.invalidateQueries({ queryKey: ["activeAuctions"] });
    };

    const handleAuctionUpdate = (
      payload: RealtimePostgresChangesPayload<AuctionPayload>
    ) => {
      if (!payload.new || !("id" in payload.new)) return;

      const updatedAuction = payload.new;
      if (updatedAuction.status !== "open") {
        setActiveAuctions((prev) =>
          prev.filter((a) => a.id !== updatedAuction.id)
        );
      } else {
        setActiveAuctions((prev) =>
          prev.map((a) =>
            a.id === updatedAuction.id ? { ...a, ...updatedAuction } : a
          )
        );
      }
    };

    const handleBidInsert = (
      payload: RealtimePostgresChangesPayload<BidPayload>
    ) => {
      if (!payload.new || !("auction_id" in payload.new)) return;

      const newBid = payload.new;
      setActiveAuctions((prev) =>
        prev.map((auction) => {
          if (auction.id === newBid.auction_id) {
            const currentBid = Number(auction.currentBid || 0);
            const newAmount = Number(newBid.amount);
            const bidders = Number(auction.bidders || 0);

            return {
              ...auction,
              currentBid: Math.max(currentBid, newAmount),
              bidders: bidders + 1,
            };
          }
          return auction;
        })
      );
    };

    const channel = supabase
      .channel("realtime-leiloes-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "auctions" },
        handleAuctionInsert
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        handleAuctionUpdate
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        handleBidInsert
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const totalValue = activeAuctions.reduce(
    (sum, auction) => sum + Number(auction.currentBid || 0),
    0
  );
  const activeAuctionsCount = activeAuctions.length;
  const totalBidders = activeAuctions.reduce(
    (sum, auction) => sum + Number(auction.bidders || 0),
    0
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCards
          title="Leilões Ativos"
          icon={<Clock />}
          contentTitle={activeAuctionsCount.toString()}
          contentDescription="leads disponíveis agora"
        />
        <StatsCards
          title="Valor Total"
          icon={<TrendingUp />}
          contentTitle={totalValue.toLocaleString("pt-BR")}
          contentDescription="em leads disponíveis"
        />
        <StatsCards
          title="Participantes"
          icon={<Users />}
          contentTitle={totalBidders.toString()}
          contentDescription="lances realizados"
        />
      </div>

      {activeAuctions && activeAuctions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {activeAuctions.map((auction) => (
            <LeadCard
              key={auction.id}
              auction={auction}
              onSelect={() => setSelectedAuction(auction)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg mt-6">
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
