"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveAuctions } from "@/lib/api";
import { AuctionModal } from "./leiloes/AuctionModal";
import { LeadCard } from "./leiloes/LeadCard";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import { LeadCard } from "./leiloes/LeadCard";
import { AuctionModal } from "./leiloes/AuctionModal";
import type { Lead as AuctionLead } from "./leads/types";
import type { AuctionRecord, AuctionRow, AuctionWithLead, LeadForAuction, Bid } from "./leiloes/types";


// Tipagem para um Leilão que inclui os dados do Lead aninhados
type AuctionWithLeadLocal = AuctionWithLead;

// Tipagem mínima para o payload do Supabase da tabela auctions
type AuctionRowLocal = AuctionRow;

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
        console.log('[LeiloesPanel] Subscribing to realtime auctions...')
        const channel = supabase
            .channel('realtime-auctions')
            // INSERT of new, still-open auctions
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'auctions'
                },
                async (payload) => {
                    console.log('[Realtime][INSERT] auctions payload:', payload)
                    const newAuction = payload.new as AuctionRowLocal;
                    // fetch related lead
                    const { data: leadData, error } = await supabase
                        .from('leads')
                        .select('*')
                        .eq('id', newAuction.lead_id)
                        .single();
                    if (error || !leadData) {
                        console.error('[Realtime][INSERT] lead fetch failed:', { error, leadId: newAuction.lead_id });
                        return;
                    }
                    const newAuctionWithLead: AuctionWithLeadLocal = {
                        ...newAuction,
                        leads: { ...(leadData as AuctionLead), expires_at: newAuction.expired_at } as LeadForAuction,
                    };
                    console.log('[Realtime][INSERT] normalized new auction:', newAuctionWithLead)
                    setActiveAuctions(prev => {
                        // dedupe by id
                        if (prev.some(a => a.id === newAuctionWithLead.id)) {
                            console.log('[Realtime][INSERT] duplicate ignored:', newAuctionWithLead.id)
                            return prev;
                        }
                        const updated = [newAuctionWithLead, ...prev]
                        console.log('[LeiloesPanel] state after INSERT:', updated)
                        return updated;
                    });
                }
            )
            // DEBUG: log any INSERT (duplicate of above but without state changes)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'auctions'
                },
                (payload) => {
                    console.log('[Realtime][DEBUG][INSERT] raw auctions insert:', payload)
                }
            )
            // UPDATE: reflect status changes and expiry updates
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'auctions'
                },
                async (payload: { new: AuctionRowLocal & { winning_bid_id?: string | null } }) => {
                    console.log('[Realtime][UPDATE] auctions payload:', payload)
                    const updated = payload.new as AuctionRowLocal & { winning_bid_id?: string | null };
                    setActiveAuctions(prev => {
                        const exists = prev.some(a => a.id === updated.id);
                        // If the auction turns closed, remove it
                        if (updated.status !== 'open') {
                            const filtered = prev.filter(a => a.id !== updated.id)
                            console.log('[LeiloesPanel] state after UPDATE -> closed:', filtered)
                            return filtered;
                        }
                        // If we have it, update fields; if not, fetch lead and add (edge case)
                        if (exists) {
                            const mapped = prev.map(a => a.id === updated.id ? { ...a, status: updated.status, expired_at: updated.expired_at, leads: { ...a.leads, expires_at: updated.expired_at } } : a)
                            console.log('[LeiloesPanel] state after UPDATE -> open change:', mapped)
                            return mapped;
                        }
                        return prev;
                    });

                }
            )
            // BIDS: update list stats when new bids arrive
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'bids'
                },
                (payload) => {
                    const bid = payload.new as { auction_id: string; amount: number | string; user_id: string };
                    console.log('[Realtime][INSERT] bids payload:', bid)
                    setActiveAuctions(prev => prev.map(a => {
                        if (a.id !== bid.auction_id) return a;
                        const amount = typeof bid.amount === 'string' ? parseFloat(bid.amount) : bid.amount;
                        const nextCurrent = Math.max(a.leads.currentBid || 0, amount || 0);
                        const nextBidders = (a.leads.bidders || 0) + 1;
                        const updated = { ...a, leads: { ...a.leads, currentBid: nextCurrent, bidders: nextBidders } };
                        return updated;
                    }));
                    setBidsByAuction(prev => {
                        const amount = typeof bid.amount === 'string' ? parseFloat(bid.amount) : bid.amount;
                        const newBid: Bid = {
                            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
                            leadId: activeAuctions.find(a => a.id === bid.auction_id)?.leads?.id || '',
                            userId: bid.user_id,
                            userName: bid.user_id?.slice(0, 8) || 'Participante',
                            amount,
                            timestamp: new Date()
                        };
                        const list = prev[bid.auction_id] || [];
                        if (list.some(b => b.id === newBid.id)) return prev;
                        return { ...prev, [bid.auction_id]: [newBid, ...list] };
                    });
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] channel status:', status)
            });

    return () => {
      console.log("[LeiloesPanel] Unsubscribing from realtime auctions");
      supabase.removeChannel(channel);
    };
  }, []);

    const handleExpire = (auctionId: string) => {
        // Remove o leilão da lista quando o timer expira e solicita fechamento no backend
        setActiveAuctions(prev => prev.filter(auction => auction.id !== auctionId));
        fetch(`/api/auctions/${auctionId}/close`, { method: 'POST' })
            .then(async (res) => {
                const json = await res.json().catch(() => ({}))
                console.log('[LeiloesPanel] close result:', res.status, json)
            })
            .catch((e) => console.error('[LeiloesPanel] close request failed:', e))
    };

    const user = { id: "current-user", name: "Você" };

    // Calcula os stats com base nos leilões ativos
    const totalValue = activeAuctions.reduce((sum, auction) => sum + (auction.leads.currentBid || 0), 0);
    const activeAuctionsCount = activeAuctions.length;
    const totalBidders = activeAuctions.reduce((sum, auction) => sum + (auction.leads.bidders || 0), 0);

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
