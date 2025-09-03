"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag } from "react-icons/fi";
import type { AuctionRecord, LeadForAuction } from "./leiloes/types";
import type { AuctionWithLead } from "./leiloes/types";
import type { Lead } from "./leads/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";
import type { Bid } from "./leiloes/types";
import LeiloesPanel from "./LeiloesPanel";

export default function Dashboard({
  initialAuctions,
  initialPurchasedLeads,
}: {
  initialAuctions: AuctionRecord[];
  initialPurchasedLeads: LeadForAuction[];
}) {
  const supabase = createClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const userIdRef = useRef<string | undefined>(undefined);
  const bidsByAuctionRef = useRef<
    Record<string, { userId: string; id: string }[]>
  >({});
  const setInitialAuctions = useRealtimeStore(
    (s: RealtimeState) => s.setInitialAuctions
  );
  const setInitialPurchasedLeads = useRealtimeStore(
    (s: RealtimeState) => s.setInitialPurchasedLeads
  );
  const upsertAuctionWithLead = useRealtimeStore(
    (s: RealtimeState) => s.upsertAuctionWithLead
  );
  const updateAuctionFields = useRealtimeStore(
    (s: RealtimeState) => s.updateAuctionFields
  );
  const removeAuctionById = useRealtimeStore(
    (s: RealtimeState) => s.removeAuctionById
  );
  const addBidForAuction = useRealtimeStore(
    (s: RealtimeState) => s.addBidForAuction
  );
  const updateAuctionStatsFromBid = useRealtimeStore(
    (s: RealtimeState) => s.updateAuctionStatsFromBid
  );
  const addPurchasedLeadIfMissing = useRealtimeStore(
    (s: RealtimeState) => s.addPurchasedLeadIfMissing
  );
  const fetchUserLeads = useRealtimeStore(
    (s: RealtimeState) => s.fetchUserLeads
  );
  const subscribeToUserLeads = useRealtimeStore(
    (s: RealtimeState) => s.subscribeToUserLeads
  );
  const unsubscribeFromUserLeads = useRealtimeStore(
    (s: RealtimeState) => s.unsubscribeFromUserLeads
  );
  const setBidsForAuction = useRealtimeStore(
    (s: RealtimeState) => s.setBidsForAuction
  );
  const userCredits = useRealtimeStore((s: RealtimeState) => s.userCredits);
  const subscribeToUserCredits = useRealtimeStore(
    (s: RealtimeState) => s.subscribeToUserCredits
  );
  const subscribeToUserPurchases = useRealtimeStore(
    (s: RealtimeState) => s.subscribeToUserPurchases
  );
  const fetchLatestUserPurchases = useRealtimeStore(
    (s: RealtimeState) => s.fetchLatestUserPurchases
  );

  useEffect(() => {
    userIdRef.current = userId;
    console.log("[Dashboard] userId:", userId);
  }, [userId]);

  useEffect(() => {
    if (session?.user?.id) {
      console.log('[Dashboard] Subscribing to user credits by id', { userId: session.user.id });
      subscribeToUserCredits(session.user.id);
      console.log('[Dashboard] Subscribing to user purchases + fetch initial');
      fetchLatestUserPurchases({ userId: session?.user?.id, limit: 5 });
      subscribeToUserPurchases({ userId: session?.user?.id });
    }
  }, [session?.user?.id, subscribeToUserCredits, fetchLatestUserPurchases, subscribeToUserPurchases]);

  const normalizedInitialAuctions: AuctionWithLead[] = useMemo(() => {
    const mapped = (initialAuctions || []).map((auction) => ({
      id: auction.id,
      status: auction.status,
      expired_at: auction.expired_at,
      leads: {
        ...(auction.leads as Lead),
        expires_at: auction.expired_at,
      } as LeadForAuction,
    }));
    console.log("[Dashboard] normalizedInitialAuctions count:", mapped.length);
    return mapped;
  }, [initialAuctions]);

  useEffect(() => {
    console.log("[Dashboard] setInitial state", {
      auctions: normalizedInitialAuctions.length,
      purchasedLeads: (initialPurchasedLeads as unknown as Lead[])?.length || 0,
    });
    setInitialAuctions(normalizedInitialAuctions);
    setInitialPurchasedLeads(
      (initialPurchasedLeads as unknown as Lead[]) || []
    );
  }, [
    normalizedInitialAuctions,
    initialPurchasedLeads,
    setInitialAuctions,
    setInitialPurchasedLeads,
  ]);

  useEffect(() => {
    console.log("[Dashboard] Prefetch bids start");
    const load = async () => {
      const auctionIds = normalizedInitialAuctions.map((a) => a.id);
      console.log("[Dashboard] Prefetch auctionIds:", auctionIds);
      await Promise.all(
        auctionIds.map(async (auctionId) => {
          const { data, error } = await supabase
            .from("bids")
            .select("*")
            .eq("auction_id", auctionId)
            .order("created_at", { ascending: false });
          if (error) {
            console.error("[Dashboard] Prefetch bids error:", {
              auctionId,
              error: error.message,
            });
            return;
          }
          const mapped: Bid[] = (data || []).map(
            (row: {
              id: string;
              user_id: string;
              amount: number | string;
              created_at: string;
            }) => ({
              id: row.id,
              leadId: "",
              userId: row.user_id,
              userName: row.user_id?.slice(0, 8) || "Participante",
              amount:
                typeof row.amount === "string"
                  ? parseFloat(row.amount)
                  : row.amount,
              timestamp: new Date(row.created_at),
            })
          );
          setBidsForAuction(auctionId, mapped);
          console.log(
            "[Dashboard] Prefetch bids done for",
            auctionId,
            "count:",
            mapped.length
          );
        })
      );
    };
    if (normalizedInitialAuctions.length > 0) {
      load();
    }
  }, [normalizedInitialAuctions, supabase, setBidsForAuction]);
  useEffect(() => {
    console.log("[Dashboard] Subscribing auctions/bids realtime");
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "auctions" },
        async (payload: {
          new: {
            id: string;
            status: string;
            expired_at: string;
            lead_id: string;
          };
        }) => {
          const newRow = payload.new;
          const { data: leadData } = await supabase
            .from("leads")
            .select("*")
            .eq("id", newRow.lead_id)
            .single();
          if (!leadData) return;
          upsertAuctionWithLead({
            id: newRow.id,
            status: newRow.status,
            expired_at: newRow.expired_at,
            leads: {
              ...(leadData as Lead),
              expires_at: newRow.expired_at,
            } as LeadForAuction,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        (payload: {
          new: {
            id: string;
            status: string;
            expired_at: string;
            lead_id: string;
            winning_bid_id?: string | null;
          };
        }) => {
          const updated = payload.new;
          if (updated.status !== "open") {
            removeAuctionById(updated.id);
          } else {
            updateAuctionFields(updated.id, {
              status: updated.status,
              expired_at: updated.expired_at,
            });
          }

          const currentUserId = userIdRef.current;
          if (!currentUserId) return;
          const auctionBids = bidsByAuctionRef.current[updated.id] || [];
          if (updated.status === "closed_won") {
            const winningBidId = updated.winning_bid_id as string | null;
            if (winningBidId) {
              const winningBid = auctionBids.find((b) => b.id === winningBidId);
              if (winningBid && winningBid.userId === currentUserId) {
                toast.success("Parabéns! Você ganhou o leilão!", {
                  description: "Veja o lead em Meus Leads.",
                });
                (async () => {
                  try {
                    const { data } = await supabase
                      .from("leads")
                      .select("*")
                      .eq("id", updated.lead_id)
                      .single();
                    if (data?.id) {
                      console.log(
                        "[Dashboard] Ensuring purchased lead via Supabase:",
                        data.id
                      );
                      addPurchasedLeadIfMissing(data as unknown as Lead);
                    }
                  } catch { }
                })();
              } else if (auctionBids.some((b) => b.userId === currentUserId)) {
                toast("Leilão encerrado", {
                  description:
                    "Outro usuário venceu. Seus créditos retornaram.",
                });
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        (payload: {
          new: {
            id: string;
            auction_id: string;
            user_id: string;
            amount: number | string;
          };
        }) => {
          const row = payload.new;
          const amount =
            typeof row.amount === "string"
              ? parseFloat(row.amount)
              : row.amount;
          updateAuctionStatsFromBid(row.auction_id, amount);
          addBidForAuction(row.auction_id, {
            id: row.id,
            leadId: "",
            userId: row.user_id,
            userName: row.user_id?.slice(0, 8) || "Participante",
            amount,
            timestamp: new Date(),
          });
          const list = bidsByAuctionRef.current[row.auction_id] || [];
          if (!list.some((b) => b.id === row.id)) {
            bidsByAuctionRef.current[row.auction_id] = [
              { id: row.id, userId: row.user_id },
              ...list,
            ].slice(0, 100);
          }
        }
      )
      .subscribe((status) => {
        console.log("[Dashboard] auctions/bids channel status:", status);
      });

    return () => {
      console.log("[Dashboard] Unsubscribing auctions/bids realtime");
      supabase.removeChannel(channel);
    };
  }, [
    supabase,
    upsertAuctionWithLead,
    updateAuctionFields,
    removeAuctionById,
    updateAuctionStatsFromBid,
    addBidForAuction,
    addPurchasedLeadIfMissing,
    setBidsForAuction,
  ]);
  useEffect(() => {
    if (!userId) {
      console.warn("[Dashboard] Skip leads realtime: no userId");
      return;
    }
    console.log('[Dashboard] Fetch + Subscribe user leads');
    fetchUserLeads(userId, 200);
    subscribeToUserLeads(userId);
    return () => {
      unsubscribeFromUserLeads();
    };
  }, [userId, fetchUserLeads, subscribeToUserLeads, unsubscribeFromUserLeads]);
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
            <TabsTrigger value="leiloes" className="flex items-center">
              <IoMdTrendingUp className="mr-2" />
              <span>Leilões</span>
              {initialAuctions.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-semibold text-black">
                  {initialAuctions.length}
                </span>
              )}
            </TabsTrigger>
          </div>
        </TabsList>
        <TabsContent value="creditos">
          <CreditosPanel currentCredits={userCredits} />
        </TabsContent>
        <TabsContent value="meus-leads">
          <MeusLeadsPanel />
        </TabsContent>
        <TabsContent value="leiloes">
          <LeiloesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
