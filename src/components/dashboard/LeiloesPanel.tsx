import { compareBands, bandOverlapsRange } from "@/lib/revenueBands";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import { LeadCard } from "./leiloes/LeadCard";
import { AuctionModal } from "./leiloes/AuctionModal";
import type { AuctionWithLead, Bid, LeadForAuction } from "./leiloes/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";
import { ToastBus } from "@/lib/toastBus";
import { sortLeads } from "@/lib/sortLeads";
import RevenueFilterSort, { RevenueFilterValue } from "./leiloes/RevenueFilterSort";
import DemoAuctionsButton from "./leiloes/DemoAuctionsButton";
import { BRAZIL_STATES, stateToUf } from "@/lib/br-states";

type AuctionWithLeadLocal = AuctionWithLead;

export default function LeiloesPanel({ setDemoLead }: { setDemoLead: (lead: LeadForAuction) => void }) {
  const { data: session } = useSession();
  const activeAuctions = useRealtimeStore(
    (s: RealtimeState) => s.activeAuctions
  ) as AuctionWithLeadLocal[];
  const removeAuctionById = useRealtimeStore(
    (s: RealtimeState) => s.removeAuctionById
  );
  const addDemoWonLead = useRealtimeStore((s) => (s as unknown as { addDemoWonLead: (l: LeadForAuction) => void }).addDemoWonLead);
  const removeDemoAuctionById = useRealtimeStore((s) => (s as unknown as { removeDemoAuctionById: (id: string) => void }).removeDemoAuctionById);
  const [selectedAuction, setSelectedAuction] =
    useState<AuctionWithLeadLocal | null>(null);
  const [revFilter, setRevFilter] = useState<RevenueFilterValue>({ sort: "none" });
  const [demoAuctions, setDemoAuctions] = useState<AuctionWithLeadLocal[]>([]);
  const setDemoAuctionsGlobal = useRealtimeStore((s) => (s as unknown as { setDemoAuctions: (a: AuctionWithLeadLocal[]) => void }).setDemoAuctions);
  const [isFiltering, setIsFiltering] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const bidsByAuctionStore = useRealtimeStore(
    (s: RealtimeState) => s.bidsByAuction
  ) as Record<string, Bid[]>;
  const normalizeStr = (s: string) =>
    String(s || "")
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  const ufToName = useMemo(() => {
    const m = new Map<string, string>();
    BRAZIL_STATES.forEach(s => m.set(s.uf.toUpperCase(), s.name));
    return m;
  }, []);

  const globalDemoAuctions = useRealtimeStore((s) => (s as unknown as { demoAuctions: AuctionWithLeadLocal[] }).demoAuctions) as AuctionWithLeadLocal[];

  useEffect(() => {
    if (globalDemoAuctions && globalDemoAuctions.length > 0 && demoAuctions.length === 0) {
      setDemoAuctions(globalDemoAuctions);
    }
  }, [globalDemoAuctions, demoAuctions.length]);

  // Fetch user role
  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    async function fetchRole() {
      try {
        const res = await fetch('/api/me/role', { cache: 'no-store' });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role ?? null);
        }
      } catch {
        if (!active) return;
      }
    }
    fetchRole();
    return () => { active = false; };
  }, [session?.user?.id]);

  const { sortedAuctions, availableStateUFs } = useMemo(() => {
    const source = [...activeAuctions, ...(globalDemoAuctions.length ? globalDemoAuctions : demoAuctions)];
    if (!source || source.length === 0) {
      return { sortedAuctions: [] as AuctionWithLead[], availableStateUFs: [] as string[] };
    }

    // Start from all leads
    let leads: LeadForAuction[] = source.map((auction) => auction.leads as LeadForAuction);

    // Apply revenue filters first
    if (revFilter.min != null) {
      leads = leads.filter(l => bandOverlapsRange(String(l.revenue), revFilter.min as number, null));
    }
    if (revFilter.max != null) {
      leads = leads.filter(l => bandOverlapsRange(String(l.revenue), null, revFilter.max as number));
    }

    // Available UFs based on the currently revenue-filtered leads
    const availableUFSet = new Set<string>();
    leads.forEach(l => {
      const uf = stateToUf(l.state) || undefined;
      if (uf) availableUFSet.add(uf.toUpperCase());
    });
    const availableUFs = Array.from(availableUFSet);

    // Apply location filter (match against state name and UF, accent-insensitive)
    if ((revFilter.locationQuery || "").trim() !== "") {
      const q = normalizeStr(revFilter.locationQuery as string);
      leads = leads.filter((l) => {
        const uf = (stateToUf(l.state) || "").toUpperCase();
        const name = ufToName.get(uf) || "";
        const norm = `${normalizeStr(name)} ${uf.toLowerCase()}`;
        const qUf = uf.toLowerCase();
        return norm.startsWith(q) || qUf.startsWith(q);
      });
    }

    // Sort
    let sortedLeads = sortLeads(leads);
    if (revFilter.sort === 'asc') {
      sortedLeads = [...sortedLeads].sort((a, b) => compareBands(String(a.revenue), String(b.revenue)));
    } else if (revFilter.sort === 'desc') {
      sortedLeads = [...sortedLeads].sort((a, b) => compareBands(String(b.revenue), String(a.revenue)));
    }

    // Map back to auctions
    const auctionMap = new Map(
      source.map((auction) => [auction.leads.id, auction])
    );
    const auctions = sortedLeads
      .map((lead) => auctionMap.get(lead.id))
      .filter(Boolean) as AuctionWithLead[];

    return { sortedAuctions: auctions, availableStateUFs: availableUFs };
  }, [activeAuctions, demoAuctions, globalDemoAuctions, revFilter.min, revFilter.max, revFilter.locationQuery, revFilter.sort, ufToName]);


  const noResults = sortedAuctions.length === 0 && (activeAuctions.length + demoAuctions.length) > 0 && (revFilter.locationQuery?.trim() || "").length > 0;

  const handleExpire = (auctionId: string) => {
    if (auctionId.startsWith('demo-')) {
      ToastBus.notifyAuctionExpired(auctionId);
      const bids = bidsByAuctionStore[auctionId] || [];
      const currentUserId = session?.user?.id;
      const userParticipated = bids.some(b => b.userId === currentUserId);
      const demoAuction = demoAuctions.find(a => a.id === auctionId);
      if (userParticipated && demoAuction) {
        ToastBus.notifyAuctionWon(auctionId);
        try { setDemoLead(demoAuction.leads as LeadForAuction); } catch { }
        try { addDemoWonLead(demoAuction.leads as LeadForAuction); } catch { }
      } else if (!userParticipated) {
        ToastBus.notifyAuctionLost(auctionId);
      }
      setDemoAuctions(prev => prev.filter(a => a.id !== auctionId));
      try { removeDemoAuctionById(auctionId); } catch { }
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
  const totalValue = useMemo(() => {
    return sortedAuctions.reduce((sum, auction) => {
      if (auction.type === "batch" && auction.batchSummary) {
        const baseline = auction.batchSummary.minimumBid || 0;
        const current = auction.leads.currentBid || 0;
        return sum + Math.max(baseline, current);
      }
      return sum + (auction.leads.currentBid || 0);
    }, 0);
  }, [sortedAuctions]);
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

  // If the selected UF no longer exists among available leads after updates/expirations,
  // clear the location filter so the list follows the normal flow.
  useEffect(() => {
    const loc = (revFilter.locationQuery || "").trim();
    if (!loc) return;
    // Only clear automatically if it's a known UF (from states list) and no longer available
    const upper = loc.toUpperCase();
    const isKnownUF = BRAZIL_STATES.some(s => s.uf === upper);
    if (isKnownUF && !availableStateUFs.includes(upper)) {
      setRevFilter(prev => ({ ...prev, locationQuery: "" }));
    }
  }, [availableStateUFs, revFilter.locationQuery]);

  useEffect(() => {
    if (!selectedAuction) return;
    const stillActive = [...activeAuctions, ...demoAuctions].some(a => a.id === selectedAuction.id);
    if (!stillActive) {
      setSelectedAuction(null);
    }
  }, [activeAuctions, demoAuctions, selectedAuction]);

  // Remove demo auction when modal signals close (buy-now demo)
  useEffect(() => {
    const onDemoClosed = (e: Event) => {
      const anyE = e as unknown as { detail?: { id?: string } };
      const id = anyE?.detail?.id;
      if (!id) return;
      setDemoAuctions(prev => prev.filter(a => a.id === id ? false : true));
      try { removeDemoAuctionById(id); } catch { }
    };
    window.addEventListener('demo-auction-closed', onDemoClosed as unknown as EventListener);
    return () => window.removeEventListener('demo-auction-closed', onDemoClosed as unknown as EventListener);
  }, [removeDemoAuctionById]);

  // Keep selectedAuction in sync with latest store updates (e.g., expired_at changes)
  useEffect(() => {
    if (!selectedAuction) return;
    const latest = activeAuctions.find(a => a.id === selectedAuction.id);
    if (!latest) return;
    const changed = (
      latest.expired_at !== selectedAuction.expired_at ||
      (latest.leads?.expires_at !== selectedAuction.leads?.expires_at) ||
      latest.minimum_bid !== selectedAuction.minimum_bid ||
      latest.status !== selectedAuction.status
    );
    if (changed) {
      setSelectedAuction(latest as AuctionWithLeadLocal);
    }
  }, [activeAuctions, selectedAuction]);

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
        // Anti-sniping demo: se houve novo bid e estamos no último minuto, estende
        let nextExpiresAt = a.leads.expires_at;
        try {
          const nowMs = Date.now();
          const expMs = new Date(a.leads.expires_at).getTime();
          const remainingMs = expMs - nowMs;
          if (Number.isFinite(remainingMs) && remainingMs <= 60_000) {
            const extendToMs = remainingMs > 30_000 ? 60_000 : 30_000;
            nextExpiresAt = new Date(nowMs + extendToMs).toISOString();
          }
        } catch { }
        const nextMin = topAmount > 0 ? Math.ceil(topAmount * 1.10) : (a.minimum_bid || undefined);
        return { ...a, minimum_bid: nextMin, leads: { ...a.leads, currentBid: topAmount, bidders: count, expires_at: nextExpiresAt } } as AuctionWithLeadLocal;
      }
      return a;
    });
    if (changed) {
      setDemoAuctions(next);
      try { setDemoAuctionsGlobal(next); } catch { }
    }
  }, [bidsByAuctionStore, demoAuctions, setDemoAuctionsGlobal]);

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
            <RevenueFilterSort value={revFilter} onChange={setRevFilter} availableStateUFs={availableStateUFs} />
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
            auctionType={auction.type}
            batchSummary={auction.batchSummary}
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
      {userRole === 'admin' && (
        <DemoAuctionsButton
          visible={demoAuctions.length === 0}
          onCreate={(auctions) => {
            const arr = auctions as AuctionWithLeadLocal[];
            setDemoAuctions(arr);
            try { setDemoAuctionsGlobal(arr); } catch { }
          }}
        />
      )}
      {selectedAuction && (
        <AuctionModal
          auctionId={selectedAuction.id}
          lead={selectedAuction.leads}
          user={user}
          onClose={() => setSelectedAuction(null)}
          onDemoWin={(wonLead) => {
            try { setDemoLead(wonLead as LeadForAuction); } catch { }
          }}
        />
      )}
    </>
  );
}
