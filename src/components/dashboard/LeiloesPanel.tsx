import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import { LeadCard } from "./leiloes/LeadCard";
import { AuctionModal } from "./leiloes/AuctionModal";
import type { AuctionWithLead, Bid } from "./leiloes/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";
import { ToastBus } from "@/lib/toastBus";
import { sortLeads } from "@/lib/sortLeads";
import RevenueFilterSort, { RevenueFilterValue } from "./leiloes/RevenueFilterSort";
import DemoAuctionsButton from "./leiloes/DemoAuctionsButton";

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
  const [revFilter, setRevFilter] = useState<RevenueFilterValue>({ sort: "none" });
  const [demoAuctions, setDemoAuctions] = useState<AuctionWithLeadLocal[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const bidsByAuctionStore = useRealtimeStore(
    (s: RealtimeState) => s.bidsByAuction
  ) as Record<string, Bid[]>;
  const normalizeStr = (s: string) =>
    String(s || "")
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  const sortedAuctions = useMemo(() => {
    const source = [...activeAuctions, ...demoAuctions];
    if (!source || source.length === 0) {
      return [];
    }

    let leads = source.map((auction) => auction.leads);

    if (revFilter.min != null) {
      leads = leads.filter(l => (Number(l.revenue) || 0) >= (revFilter.min as number));
    }
    if (revFilter.max != null) {
      leads = leads.filter(l => (Number(l.revenue) || 0) <= (revFilter.max as number));
    }

    if (revFilter.locationQuery && revFilter.locationQuery.trim() !== "") {
      const q = normalizeStr(revFilter.locationQuery);
      leads = leads.filter((l) => normalizeStr(l.location as string).startsWith(q));
    }

    let sortedLeads = sortLeads(leads);
    if (revFilter.sort === 'asc') {
      sortedLeads = [...sortedLeads].sort((a, b) => (Number(a.revenue) || 0) - (Number(b.revenue) || 0));
    } else if (revFilter.sort === 'desc') {
      sortedLeads = [...sortedLeads].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0));
    }

    const auctionMap = new Map(
      source.map((auction) => [auction.leads.id, auction])
    );
    return sortedLeads
      .map((lead) => auctionMap.get(lead.id))
      .filter(Boolean) as AuctionWithLead[];
  }, [activeAuctions, demoAuctions, revFilter]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    [...activeAuctions, ...demoAuctions].forEach(a => {
      const loc = String(a.leads.location || "").trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeAuctions, demoAuctions]);

  const noResults = sortedAuctions.length === 0 && (activeAuctions.length + demoAuctions.length) > 0 && (revFilter.locationQuery?.trim() || "").length > 0;

  const handleExpire = (auctionId: string) => {
    if (auctionId.startsWith('demo-')) {
      ToastBus.notifyAuctionExpired(auctionId);
      const bids = bidsByAuctionStore[auctionId] || [];
      const top = [...bids].sort((a, b) => b.amount - a.amount)[0];
      const currentUserId = session?.user?.id;
      const userParticipated = bids.some(b => b.userId === currentUserId);
      if (top && currentUserId && top.userId === currentUserId) {
        ToastBus.notifyAuctionWon(auctionId);
      } else if (userParticipated) {
        ToastBus.notifyAuctionLost(auctionId);
      }
      setDemoAuctions(prev => prev.filter(a => a.id !== auctionId));
      setTimeout(() => {
        const clearDemo = useRealtimeStore.getState().clearDemoMode;
        clearDemo();
      }, 0);
      return;
    }
    removeAuctionById(auctionId);
    ToastBus.notifyAuctionExpired(auctionId);
    fetch(`/api/auctions/${auctionId}/close`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          ToastBus.error(
            "Falha ao fechar leilão",
            "Houve um problema ao processar o resultado."
          );
        }
      })
      .catch((e) => {
        console.error("[LeiloesPanel] close request failed:", e);
        ToastBus.error(
          "Erro de rede",
          "Não foi possível comunicar com o servidor para fechar o leilão."
        );
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
  const isFiltered = (revFilter.min != null) || (revFilter.max != null) || ((revFilter.locationQuery || "").trim() !== "");
  const totalBidders = useMemo(
    () =>
      sortedAuctions.reduce(
        (sum, auction) => sum + (auction.leads.bidders || 0),
        0
      ),
    [sortedAuctions]
  );

  useEffect(() => {
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 250);
    return () => clearTimeout(t);
  }, [revFilter]);

  useEffect(() => {
    if (!selectedAuction) return;
    const stillActive = [...activeAuctions, ...demoAuctions].some(a => a.id === selectedAuction.id);
    if (!stillActive) {
      setSelectedAuction(null);
    }
  }, [activeAuctions, demoAuctions, selectedAuction]);

  useEffect(() => {
    if (demoAuctions.length === 0) return;
    let changed = false;
    const next = demoAuctions.map(a => {
      if (!a.id.startsWith('demo-')) return a;
      const bids = bidsByAuctionStore[a.id] || [];
      const topAmount = bids.length > 0 ? Math.max(...bids.map(b => b.amount || 0)) : (a.leads.currentBid || 0);
      const count = bids.length;
      if (topAmount !== a.leads.currentBid || count !== a.leads.bidders) {
        changed = true;
        return { ...a, leads: { ...a.leads, currentBid: topAmount, bidders: count } } as AuctionWithLeadLocal;
      }
      return a;
    });
    if (changed) setDemoAuctions(next);
  }, [bidsByAuctionStore, demoAuctions]);

  return (
    <>
      {(activeAuctions.length + demoAuctions.length) > 0 && (
        <>
          <StatsCards
            items={[
              {
                title: "Leilões Ativos",
                icon: <Clock />,
                contentTitle: activeAuctionsCount.toString(),
                contentDescription: isFiltered ? "leads disponíveis agora (filtrados)" : "leads disponíveis agora",
              },
              {
                title: "Valor Total",
                icon: <TrendingUp />,
                contentTitle: `R$ ${totalValue.toLocaleString("pt-BR")}`,
                contentDescription: "em leads disponíveis",
              },
              {
                title: "Participantes",
                icon: <Users />,
                contentTitle: totalBidders.toString(),
                contentDescription: "Número de lances",
              },
            ]}
          />
          <div className="mt-4">
            <RevenueFilterSort value={revFilter} onChange={setRevFilter} availableLocations={locations} />
          </div>
        </>
      )}
      {noResults && (
        <div className="mt-6 text-center text-sm text-muted-foreground">Não existem leilões para a localidade informada no momento.</div>
      )}
      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6 transition-opacity duration-200 ${isFiltering ? 'opacity-0' : 'opacity-100'}`}>
        {sortedAuctions.map((auction) => (
          <LeadCard
            key={auction.id}
            lead={auction.leads}
            onExpire={() => handleExpire(auction.id)}
            onSelect={() => setSelectedAuction(auction)}
          />
        ))}
      </div>

      {(activeAuctions.length + demoAuctions.length) === 0 && (
        <div className="text-center py-12 col-span-full">
          <div className="text-gray-400 text-lg mb-2">
            Nenhum leilão ativo no momento
          </div>
          <p className="text-gray-500">Aguarde novos leads</p>
        </div>
      )}
      {session?.user?.email === 'yago@assessorialpha.com' && (
        <DemoAuctionsButton
          visible={demoAuctions.length === 0}
          onCreate={(auctions) => setDemoAuctions(auctions as AuctionWithLeadLocal[])}
        />
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
