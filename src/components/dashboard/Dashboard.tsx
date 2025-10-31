"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSession } from "next-auth/react";
import { ToastBus } from "@/lib/toastBus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag, FiInfo } from "react-icons/fi";
import type { Lead } from "./leads/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";
import type {
  Bid,
  AuctionWithLead,
  AuctionRecord,
  LeadForAuction,
  BatchAuctionSummary,
  AuctionKind,
} from "./leiloes/types";
import LeiloesPanel from "./LeiloesPanel";
import InfoPanel from "./InfoPanel";
import { TermsGate } from "@/components/TermsGate";
import Link from "next/link";

export default function Dashboard({
  initialAuctions,
  initialPurchasedLeads,
}: {
  initialAuctions: AuctionRecord[];
  initialPurchasedLeads: LeadForAuction[];
}) {
  const supabase = createClient();
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const [tabValue, setTabValue] = useState<string>("creditos");
  const userIdRef = useRef<string | undefined>(undefined);
  const pendingBatchFetches = useRef<Set<string>>(new Set());
  const [demoLead, setDemoLead] = useState<LeadForAuction | null>(null);
  // demoLead is passed to MeusLeadsPanel
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
  const setBatchSummary = useRealtimeStore(
    (s: RealtimeState) => (s as unknown as { setBatchSummary: (id: string, summary: BatchAuctionSummary | null) => void }).setBatchSummary
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
  const subscribeToUserCreditHolds = useRealtimeStore(
    (s: RealtimeState) => s.subscribeToUserCreditHolds
  );
  const subscribeToUserPurchases = useRealtimeStore(
    (s: RealtimeState) => s.subscribeToUserPurchases
  );
  const fetchLatestUserPurchases = useRealtimeStore(
    (s: RealtimeState) => s.fetchLatestUserPurchases
  );
  const activeAuctions = useRealtimeStore(
    (s: RealtimeState) => s.activeAuctions
  ) as AuctionWithLead[];

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const fetchBatchSummary = useCallback(async (auctionId: string) => {
    if (!auctionId || pendingBatchFetches.current.has(auctionId)) return;
    pendingBatchFetches.current.add(auctionId);
    try {
      const res = await fetch(`/api/auction/${auctionId}/batch`, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      const leads = Array.isArray(payload?.leads)
        ? payload.leads.map((lead: Partial<Lead>): LeadForAuction => ({
          id: lead.id ?? "",
          name: lead.name ?? (lead.company_name as string) ?? "",
          description: lead.description ?? "",
          status: (lead.status as Lead["status"]) ?? "cold",
          expires_at: "",
          channel: lead.channel ?? "",
          revenue: lead.revenue ?? "",
          marketing_investment: lead.marketing_investment ?? "",
          company_name: lead.company_name ?? "",
          contact_name: lead.contact_name ?? "",
          cnpj: lead.cnpj ?? "",
          state: lead.state ?? "",
          city: lead.city ?? "",
          phone: lead.phone ?? "",
          email: lead.email ?? "",
          maskedCompanyName: (lead as { maskedCompanyName?: string }).maskedCompanyName ?? lead.company_name ?? "",
          niche: lead.niche ?? "",
          maskedContactName: (lead as { maskedContactName?: string }).maskedContactName ?? lead.contact_name ?? "",
          maskedPhone: (lead as { maskedPhone?: string }).maskedPhone ?? lead.phone ?? "",
          maskedEmail: (lead as { maskedEmail?: string }).maskedEmail ?? lead.email ?? "",
          currentBid: typeof lead.currentBid === "number" ? lead.currentBid : 0,
          owner_id: lead.owner_id,
          bidders: typeof lead.bidders === "number" ? lead.bidders : 0,
          minimum_value: Number(lead.minimum_value ?? 0),
          category: lead.category ?? "",
          document_url: lead.document_url ?? "",
          contract_url: lead.contract_url ?? "",
          contract_time: lead.contract_time ?? "",
          contract_value: Number(lead.contract_value ?? 0),
          contract_installments: lead.contract_installments != null ? Number(lead.contract_installments) : null,
          cal_url: lead.cal_url ?? "",
          briefing_url: lead.briefing_url ?? "",
          tags: Array.isArray(lead.tags) ? (lead.tags as string[]) : [],
          batched_at: lead.batched_at ?? null,
          batch_auction_id: lead.batch_auction_id ?? null,
          batch_result: lead.batch_result ?? null,
        }))
        : [];
      const summary: BatchAuctionSummary = {
        id: payload.id,
        totalLeads: Number(payload.totalLeads ?? leads.length),
        leadUnitPrice: Number(payload.leadUnitPrice ?? 0),
        minimumBid: Number(payload.minimumBid ?? 0),
        status: payload.status,
        result: payload.result,
        leads,
      };
      setBatchSummary(auctionId, summary);
    } catch (error) {
      console.warn("[Dashboard] Failed to fetch batch summary", error);
    } finally {
      pendingBatchFetches.current.delete(auctionId);
    }
  }, [setBatchSummary]);

  useEffect(() => {
    console.log(userId)
  }, [userId])

  useEffect(() => {
    if (session?.user?.id) {
      subscribeToUserCredits(session.user.id);
      subscribeToUserCreditHolds(session.user.id);
      fetchLatestUserPurchases({ userId: session?.user?.id, limit: 5 });
      subscribeToUserPurchases({ userId: session?.user?.id });
    }
  }, [session?.user?.id, subscribeToUserCredits, subscribeToUserCreditHolds, fetchLatestUserPurchases, subscribeToUserPurchases, session]);

  const normalizedInitialAuctions: AuctionWithLead[] = useMemo(() => {
    const mapped = (initialAuctions || []).map((auction) => {
      const rawType = (auction as AuctionRecord & { type?: string }).type ?? "single";
      const auctionType: AuctionKind = rawType === "batch" ? "batch" : "single";
      return {
        id: auction.id,
        status: auction.status,
        expired_at: auction.expired_at,
        type: auctionType,
        minimum_bid:
          typeof auction.minimum_bid === "string"
            ? parseFloat(auction.minimum_bid)
            : auction.minimum_bid ?? undefined,
        leads: {
          ...(auction.leads as Lead),
          expires_at: auction.expired_at,
        } as LeadForAuction,
      };
    });
    return mapped;
  }, [initialAuctions]);

  useEffect(() => {
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
    normalizedInitialAuctions
      .filter((auction) => auction.type === "batch")
      .forEach((auction) => {
        void fetchBatchSummary(auction.id);
      });
  }, [normalizedInitialAuctions, fetchBatchSummary]);

  // Choose default tab based on initial auctions on first load
  useEffect(() => {
    if (normalizedInitialAuctions.length > 0) {
      setTabValue("leiloes");
    } else {
      setTabValue("creditos");
    }
    // run only once for default selection purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      const auctionIds = normalizedInitialAuctions.map((a) => a.id);
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
          try {
            const top = mapped.length > 0 ? mapped[0].amount : 0;
            const count = mapped.length;
            updateAuctionFields(auctionId, { leads: { currentBid: top, bidders: count } });
          } catch { }
        })
      );
    };
    if (normalizedInitialAuctions.length > 0) {
      load();
    }
  }, [normalizedInitialAuctions, supabase, setBidsForAuction, updateAuctionFields]);
  useEffect(() => {
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
            minimum_bid?: number | string | null;
            type?: string | null;
            batch_auction_id?: string | null;
          };
        }) => {
          const newRow = payload.new;
          console.log("[Dashboard] Auction INSERT payload received", {
            id: newRow.id,
            status: newRow.status,
            expired_at: newRow.expired_at,
            lead_id: newRow.lead_id,
          });
          const { data: leadData, error } = await supabase
            .from("leads")
            .select("*")
            .eq("id", newRow.lead_id)
            .single();
          if (error) {
            console.log("[Dashboard] Auction INSERT lead fetch failed", {
              leadId: newRow.lead_id,
              message: error.message,
            });
            return;
          }
          if (!leadData) {
            console.log("[Dashboard] Auction INSERT no lead data returned", {
              leadId: newRow.lead_id,
            });
            return;
          }
          upsertAuctionWithLead({
            id: newRow.id,
            status: newRow.status,
            expired_at: newRow.expired_at,
            type: newRow.type === "batch" ? "batch" : "single",
            minimum_bid:
              typeof newRow.minimum_bid === "string"
                ? parseFloat(newRow.minimum_bid)
                : newRow.minimum_bid ?? undefined,
            leads: {
              ...(leadData as Lead),
              expires_at: newRow.expired_at,
            } as LeadForAuction,
          });
          if (newRow.type === "batch") {
            void fetchBatchSummary(newRow.id);
          }
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
            minimum_bid?: number | string | null;
          };
        }) => {
          const updated = payload.new;
          console.log("[Dashboard] Auction UPDATE payload received", {
            id: updated.id,
            status: updated.status,
            expired_at: updated.expired_at,
            winning_bid_id: updated.winning_bid_id,
          });
          if (updated.status !== "open") {
            removeAuctionById(updated.id);
          } else {
            updateAuctionFields(updated.id, {
              status: updated.status,
              expired_at: updated.expired_at,
              minimum_bid:
                typeof updated.minimum_bid === "string"
                  ? parseFloat(updated.minimum_bid)
                  : updated.minimum_bid ?? undefined,
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
                ToastBus.notifyAuctionWon(updated.id);
                (async () => {
                  try {
                    const { data } = await supabase
                      .from("leads")
                      .select("*")
                      .eq("id", updated.lead_id)
                      .single();
                    if (data?.id) {
                      addPurchasedLeadIfMissing(data as unknown as Lead);
                    }
                  } catch {
                    console.log(
                      "[Dashboard] Auction UPDATE winner lead fetch failed",
                      { leadId: updated.lead_id }
                    );
                  }
                })();
              } else if (auctionBids.some((b) => b.userId === currentUserId)) {
                ToastBus.notifyAuctionLost(updated.id);
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
          console.log("[Dashboard] Bid INSERT payload received", {
            id: row.id,
            auction_id: row.auction_id,
            user_id: row.user_id,
          });
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
      );

    void channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("[Dashboard] Channel subscribed");
      } else if (status === "CHANNEL_ERROR") {
        console.log("[Dashboard] Channel error", err);
      } else if (status === "TIMED_OUT") {
        console.log("[Dashboard] Channel timed out");
      } else if (status === "CLOSED") {
        console.log("[Dashboard] Channel closed");
      }
    });

    return () => {
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
    fetchBatchSummary,
  ]);
  useEffect(() => {
    if (!userId) {
      if (status === "authenticated") {
        console.warn(
          "[Dashboard] Skip leads realtime: authenticated session without userId"
        );
      }
      return;
    }
    fetchUserLeads(userId, 200);
    subscribeToUserLeads(userId);
    return () => {
      unsubscribeFromUserLeads();
    };
  }, [
    userId,
    status,
    fetchUserLeads,
    subscribeToUserLeads,
    unsubscribeFromUserLeads,
  ]);
  return (
    <TermsGate>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={tabValue} onValueChange={setTabValue} className="w-full">
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
                {activeAuctions.length > 0 && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-semibold text-black">
                    {activeAuctions.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="info" className="flex items-center gap-2">
                <FiInfo className="size-4" />
                Como funciona
              </TabsTrigger>
            </div>
          </TabsList>
          <TabsContent value="creditos">
            <CreditosPanel currentCredits={userCredits} />
          </TabsContent>
          <TabsContent value="meus-leads">
            <MeusLeadsPanel demoLead={demoLead} />
          </TabsContent>
          <TabsContent value="leiloes">
            <LeiloesPanel setDemoLead={setDemoLead} />
          </TabsContent>
          <TabsContent value="info">
            <InfoPanel />
          </TabsContent>
        </Tabs>
        <footer className="mt-8 border-t pt-4 text-center text-sm text-muted-foreground">
          <span>Conheça nossos </span>
          <Link href="/termos" className="underline underline-offset-2 hover:text-foreground">
            Termos de Uso e Privacidade
          </Link>
        </footer>
      </div>
    </TermsGate>
  );
}
