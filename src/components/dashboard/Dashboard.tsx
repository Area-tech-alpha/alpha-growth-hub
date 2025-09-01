"use client";

import React, { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import LeiloesPanel from "@/components/dashboard/LeiloesPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag } from "react-icons/fi";
import type { AuctionWithLead, LeadForAuction } from "@/lib/custom-types";

interface BidPayload {
  new: { id: string; auction_id: string; user_id: string };
}
interface AuctionPayload {
  new: { id: string; status: string; winning_bid_id?: string | null };
}

export default function Dashboard({
  initialAuctions,
  initialPurchasedLeads,
}: {
  initialAuctions: AuctionWithLead[];
  initialPurchasedLeads: LeadForAuction[];
}) {
  const supabase = createClient();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const userIdRef = useRef<string | undefined>(undefined);
  const bidsByAuctionRef = useRef<
    Record<string, { userId: string; id: string }[]>
  >({});

  const {
    data: user,
    isLoading: isLoadingUser,
    isError,
  } = useQuery({
    queryKey: ["userProfile"],
    queryFn: fetchUserProfile,
    enabled: !!session,
  });

  useEffect(() => {
    userIdRef.current = session?.user?.id;
  }, [session?.user?.id]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      if (status === "cancelled") {
        toast.warning("Compra cancelada", {
          description: "Você interrompeu o processo de pagamento.",
        });
      } else if (status === "expired") {
        toast.error("Pagamento expirado", {
          description: "O link de pagamento expirou.",
        });
      }
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-global-auctions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        (payload: BidPayload) => {
          if (!payload.new) return;
          const row = payload.new;
          const list = bidsByAuctionRef.current[row.auction_id] || [];
          if (!list.some((b) => b.id === row.id)) {
            bidsByAuctionRef.current[row.auction_id] = [
              { id: row.id, userId: row.user_id },
              ...list,
            ].slice(0, 100);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        (payload: AuctionPayload) => {
          if (!payload.new) return;
          const updated = payload.new;
          if (updated.status === "open") return;
          const userId = userIdRef.current;
          if (!userId) return;
          const auctionBids = bidsByAuctionRef.current[updated.id] || [];
          if (updated.status === "closed_won") {
            const winningBidId = updated.winning_bid_id ?? null;
            if (winningBidId) {
              const winningBid = auctionBids.find((b) => b.id === winningBidId);
              if (winningBid && winningBid.userId === userId) {
                toast.success("Parabéns! Você ganhou o leilão!", {
                  description: "Veja o lead em Meus Leads.",
                });
              } else if (auctionBids.some((b) => b.userId === userId)) {
                toast("Leilão encerrado", {
                  description:
                    "Outro usuário venceu. Seus créditos retornaram.",
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (isLoadingUser) {
    return (
      <div className="container mx-auto p-8 space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="border rounded-lg p-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-10 text-red-500">
        Erro ao carregar seus dados. Por favor, tente recarregar a página.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Tabs defaultValue="leiloes" className="w-full">
        <TabsList className="pb-3 px-4 mt-2 w-full justify-center sm:justify-start">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start [--tab-row-gap:0.5rem]">
            <TabsTrigger value="leiloes" className="flex items-center gap-2">
              <IoMdTrendingUp className="size-4" />
              Leilões
            </TabsTrigger>
            <TabsTrigger value="meus-leads" className="flex items-center gap-2">
              <FiShoppingBag className="size-4" />
              Meus Leads
            </TabsTrigger>
            <TabsTrigger value="creditos" className="flex items-center gap-2">
              <CiCreditCard1 className="size-4" />
              Créditos
            </TabsTrigger>
          </div>
        </TabsList>

        <TabsContent value="leiloes" className="mt-4">
          <LeiloesPanel
            userCredits={user?.creditBalance || 0}
            initialAuctions={initialAuctions}
          />
        </TabsContent>
        <TabsContent value="meus-leads" className="mt-4">
          <MeusLeadsPanel initialPurchasedLeads={initialPurchasedLeads} />
        </TabsContent>
        <TabsContent value="creditos" className="mt-4">
          <CreditosPanel currentCredits={user?.creditBalance || 0} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
