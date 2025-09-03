import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import { LeadCard } from "./leiloes/LeadCard";
import { AuctionModal } from "./leiloes/AuctionModal";
import type { AuctionWithLead, Bid } from "./leiloes/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";
import { toast } from "sonner";
import { sortLeads } from "@/lib/sortLeads";

type AuctionWithLeadLocal = AuctionWithLead;

export default function LeiloesPanel() {
  const { data: session } = useSession();
  const activeAuctions = useRealtimeStore(
    (s: RealtimeState) => s.activeAuctions
  ) as AuctionWithLeadLocal[];
  const bidsByAuction = useRealtimeStore(
    (s: RealtimeState) => s.bidsByAuction
  ) as Record<string, Bid[]>;
  const removeAuctionById = useRealtimeStore(
    (s: RealtimeState) => s.removeAuctionById
  );
  const [selectedAuction, setSelectedAuction] =
    useState<AuctionWithLeadLocal | null>(null);
  const sortedAuctions = useMemo(() => {
    if (!activeAuctions || activeAuctions.length === 0) {
      return [];
    }

    const leads = activeAuctions.map((auction) => auction.leads);

    const sortedLeads = sortLeads(leads);

    const auctionMap = new Map(
      activeAuctions.map((auction) => [auction.leads.id, auction])
    );
    return sortedLeads
      .map((lead) => auctionMap.get(lead.id))
      .filter(Boolean) as AuctionWithLead[];
  }, [activeAuctions]);

  const handleExpire = (auctionId: string) => {
    removeAuctionById(auctionId);
    toast.info("Leilão expirado", {
      description: "Processando o resultado final do leilão...",
    });
    fetch(`/api/auctions/${auctionId}/close`, { method: "POST" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        console.log("[LeiloesPanel] close result:", res.status, json);
        if (!res.ok) {
          toast.error("Falha ao fechar leilão", {
            description: "Houve um problema ao processar o resultado.",
          });
        }
      })
      .catch((e) => {
        console.error("[LeiloesPanel] close request failed:", e);
        toast.error("Erro de rede", {
          description:
            "Não foi possível comunicar com o servidor para fechar o leilão.",
        });
      });
  };

  const user = { id: session?.user?.id, name: session?.user?.name || "Você" };
  const totalValue = useMemo(
    () =>
      sortedAuctions.reduce(
        (sum, auction) => sum + (auction.leads.currentBid || 0),
        0
      ),
    [sortedAuctions]
  );
  const activeAuctionsCount = sortedAuctions.length;
  const totalBidders = useMemo(
    () =>
      sortedAuctions.reduce(
        (sum, auction) => sum + (auction.leads.bidders || 0),
        0
      ),
    [sortedAuctions]
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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
        {sortedAuctions.map((auction) => (
          <LeadCard
            key={auction.id}
            lead={auction.leads}
            onExpire={() => handleExpire(auction.id)}
            onSelect={() => setSelectedAuction(auction)}
          />
        ))}
      </div>

      {activeAuctions.length === 0 && (
        <div className="text-center py-12 col-span-full">
          <div className="text-gray-400 text-lg mb-2">
            Nenhum leilão ativo no momento
          </div>
          <p className="text-gray-500">Aguarde novos leads</p>
        </div>
      )}
      {selectedAuction && (
        <AuctionModal
          auctionId={selectedAuction.id}
          lead={selectedAuction.leads}
          user={user}
          initialBids={bidsByAuction[selectedAuction.id]}
          onClose={() => setSelectedAuction(null)}
        />
      )}
    </>
  );
}
