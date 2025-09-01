"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveAuctions } from "@/lib/api";
import { AuctionModal } from "./leiloes/AuctionModal";
import { LeadCard } from "./leiloes/LeadCard";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import type { AuctionWithLead } from "@/lib/custom-types";

import { createClient } from "@/utils/supabase/client";

interface BrowserDecimal {
  toNumber(): number;
}

class BrowserDecimalImpl implements BrowserDecimal {
  private value: number;

  constructor(value: number | string) {
    this.value = typeof value === "string" ? parseFloat(value) : value;
  }

  toNumber(): number {
    return this.value;
  }

  static from(value: number | string): BrowserDecimal {
    return new BrowserDecimalImpl(value);
  }
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
    () => {
      const normalized = (initialAuctions || []).map((auction) => ({
        ...auction,
        leads: {
          ...auction.leads,
          expires_at: auction.expiredAt.toISOString(),
        },
      }));
      console.log("[LeiloesPanel] initialAuctions normalized:", normalized);
      return normalized;
    }
  );
  const [selectedAuction, setSelectedAuction] =
    useState<AuctionWithLead | null>(null);

  const {
    data: fetchedAuctions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["activeAuctions"],
    queryFn: fetchActiveAuctions,
    initialData: initialAuctions,
  });
  useEffect(() => {
    if (fetchedAuctions && fetchedAuctions.length > 0) {
      const normalized = fetchedAuctions.map((auction) => ({
        ...auction,
        leads: {
          ...auction.leads,
          expires_at: auction.expiredAt.toISOString(),
        },
      }));
      setActiveAuctions(normalized);
    }
  }, [fetchedAuctions]);

  useEffect(() => {
    console.log("[LeiloesPanel] Subscribing to realtime auctions...");
    const channel = supabase
      .channel("realtime-auctions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auctions",
        },
        async (payload) => {
          console.log("[Realtime][INSERT] auctions payload:", payload);
          const newAuction = payload.new as {
            id: string;
            lead_id: string;
            expired_at: string;
            created_at?: string;
            status: string;
          };
          const { data: leadData, error } = await supabase
            .from("leads")
            .select("*")
            .eq("id", newAuction.lead_id)
            .single();
          if (error || !leadData) {
            console.error("[Realtime][INSERT] lead fetch failed:", {
              error,
              leadId: newAuction.lead_id,
            });
            return;
          }
          const newAuctionWithLead = {
            ...newAuction,
            leadId: newAuction.lead_id,
            expiredAt: new Date(newAuction.expired_at),
            createdAt: newAuction.created_at
              ? new Date(newAuction.created_at)
              : new Date(),
            minimumBid: BrowserDecimalImpl.from(0),
            winningBidId: null,
            leads: leadData,
            bids: [],
            bidders: 0,
            currentBid: 0,
          };
          console.log(
            "[Realtime][INSERT] normalized new auction:",
            newAuctionWithLead
          );
          setActiveAuctions((prev) => {
            if (prev.some((a) => a.id === newAuctionWithLead.id)) {
              console.log(
                "[Realtime][INSERT] duplicate ignored:",
                newAuctionWithLead.id
              );
              return prev;
            }
            const updated = [
              newAuctionWithLead as unknown as AuctionWithLead,
              ...prev,
            ];
            console.log("[LeiloesPanel] state after INSERT:", updated);
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
        },
        async (payload) => {
          console.log("[Realtime][UPDATE] auctions payload:", payload);
          const updated = payload.new as {
            id: string;
            status: string;
            expired_at: string;
          };
          setActiveAuctions((prev) => {
            const exists = prev.some((a) => a.id === updated.id);
            if (updated.status !== "open") {
              const filtered = prev.filter((a) => a.id !== updated.id);
              console.log(
                "[LeiloesPanel] state after UPDATE -> closed:",
                filtered
              );
              return filtered;
            }
            if (exists) {
              const mapped = prev.map((a) =>
                a.id === updated.id
                  ? {
                      ...a,
                      status: updated.status,
                      expiredAt: new Date(updated.expired_at),
                      leads: { ...a.leads, expires_at: updated.expired_at },
                    }
                  : a
              );
              console.log(
                "[LeiloesPanel] state after UPDATE -> open change:",
                mapped
              );
              return mapped;
            }
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
        },
        (payload) => {
          const bid = payload.new as {
            auction_id: string;
            amount: number | string;
            user_id: string;
          };
          console.log("[Realtime][INSERT] bids payload:", bid);
          setActiveAuctions((prev) =>
            prev.map((a) => {
              if (a.id !== bid.auction_id) return a;
              const amount =
                typeof bid.amount === "string"
                  ? parseFloat(bid.amount)
                  : typeof bid.amount === "object" && bid.amount !== null
                  ? (bid.amount as BrowserDecimal).toNumber()
                  : bid.amount;
              const nextCurrent = Math.max(
                typeof a.currentBid === "object"
                  ? (a.currentBid as BrowserDecimal).toNumber()
                  : a.currentBid || 0,
                amount || 0
              );
              const nextBidders =
                (typeof a.bidders === "object"
                  ? (a.bidders as BrowserDecimal).toNumber()
                  : a.bidders || 0) + 1;
              const updated = {
                ...a,
                currentBid: nextCurrent,
                bidders: nextBidders,
              };
              return updated;
            })
          );
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] channel status:", status);
      });

    return () => {
      console.log("[LeiloesPanel] Unsubscribing from realtime auctions");
      supabase.removeChannel(channel);
    };
  }, []);

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

  const totalValue = activeAuctions.reduce(
    (sum, auction) =>
      sum +
      (typeof auction.currentBid === "object"
        ? (auction.currentBid as BrowserDecimal).toNumber()
        : auction.currentBid || 0),
    0
  );
  const activeAuctionsCount = activeAuctions.length;
  const totalBidders = activeAuctions.reduce(
    (sum, auction) =>
      sum +
      (typeof auction.bidders === "object"
        ? (auction.bidders as BrowserDecimal).toNumber()
        : auction.bidders || 0),
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
