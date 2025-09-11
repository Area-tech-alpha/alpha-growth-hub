"use client";

import { compareBands, bandOverlapsRange } from "@/lib/revenueBands";

import { useEffect, useMemo, useState } from "react";
import { FiShoppingBag } from "react-icons/fi";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchasedLeadCard } from "./leads/PurchasedLeadCard";
import type { Lead } from "./leads/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";
import { ToastBus } from "@/lib/toastBus";
import RevenueFilterSort, { type RevenueFilterValue } from "./leiloes/RevenueFilterSort";
import { useSession } from "next-auth/react";
import { LeadForAuction } from "./leiloes/types";

export default function MeusLeadsPanel({ demoLead }: { demoLead: LeadForAuction | null }) {
  const purchasedLeads = useRealtimeStore(
    (s: RealtimeState) => s.purchasedLeads
  ) as Lead[];
  const fetchUserLeads = useRealtimeStore((s) => s.fetchUserLeads);
  const subscribeToUserLeads = useRealtimeStore((s) => s.subscribeToUserLeads);
  const unsubscribeFromUserLeads = useRealtimeStore((s) => s.unsubscribeFromUserLeads);
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [isExporting, setIsExporting] = useState(false);
  const demoWonLeads = useRealtimeStore((s) => (s as unknown as { demoWonLeads: Array<LeadForAuction & { demo_price?: number }> }).demoWonLeads) as Array<LeadForAuction & { demo_price?: number }>;
  const [purchasePrices, setPurchasePrices] = useState<Record<string, number>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [revFilter, setRevFilter] = useState<RevenueFilterValue>({ sort: "none" });
  const [paidSort, setPaidSort] = useState<"none" | "asc" | "desc">("none");

  const allLeads = useMemo(() => {
    const base = purchasedLeads.slice();
    const demoList = (demoWonLeads || []).map(l => ({ ...(l as unknown as Lead) } as Lead));
    const merged = [...demoList, ...base.filter(bl => !demoList.some(dl => dl.id === bl.id))];
    return merged;
  }, [purchasedLeads, demoWonLeads]);

  useEffect(() => {
    if (!userId) return;
    // Initial load + realtime subscription
    fetchUserLeads(userId).catch(() => { });
    subscribeToUserLeads(userId);
    return () => {
      unsubscribeFromUserLeads();
    };
  }, [userId, fetchUserLeads, subscribeToUserLeads, unsubscribeFromUserLeads]);

  useEffect(() => {
    const loadPurchasePrices = async () => {
      try {
        setLoadingPrices(true);
        const realLeadIds = Array.from(new Set(purchasedLeads.map(l => l.id).filter(id => !(demoWonLeads || []).some(d => d.id === id))));
        if (realLeadIds.length === 0) { setPurchasePrices({}); return; }
        const res = await fetch('/api/leads/purchase-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: realLeadIds })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Falha ao buscar preços de compra');
        setPurchasePrices((json?.prices || {}) as Record<string, number>);
      } catch (e) {
        console.warn('[MeusLeadsPanel] loadPurchasePrices failed', e);
      } finally {
        setLoadingPrices(false);
      }
    };
    loadPurchasePrices();
  }, [purchasedLeads, demoWonLeads]);

  // Compute available states based on current revenue filter (min/max)
  const availableStateUFs = useMemo(() => {
    let leads = allLeads.slice();
    if (revFilter.min != null) {
      leads = leads.filter(l => bandOverlapsRange(String(l.revenue), revFilter.min as number, null));
    }
    if (revFilter.max != null) {
      leads = leads.filter(l => bandOverlapsRange(String(l.revenue), null, revFilter.max as number));
    }
    const setUF = new Set<string>();
    leads.forEach(l => {
      const uf = String(l.state || "").toUpperCase();
      if (uf) setUF.add(uf);
    });
    return Array.from(setUF);
  }, [allLeads, revFilter.min, revFilter.max]);

  // Apply filters and sorting (revenue sort takes precedence if chosen; otherwise sort by paid)
  const displayLeads = useMemo(() => {
    let leads = allLeads.slice();

    if (revFilter.min != null) {
      leads = leads.filter(l => bandOverlapsRange(String(l.revenue), revFilter.min as number, null));
    }
    if (revFilter.max != null) {
      leads = leads.filter(l => bandOverlapsRange(String(l.revenue), null, revFilter.max as number));
    }
    if ((revFilter.locationQuery || "").trim() !== "") {
      const uf = (revFilter.locationQuery as string).toUpperCase();
      leads = leads.filter(l => String(l.state || "").toUpperCase() === uf);
    }

    // Sorting
    if (revFilter.sort === "asc") {
      leads = [...leads].sort((a, b) => compareBands(String(a.revenue), String(b.revenue)));
    } else if (revFilter.sort === "desc") {
      leads = [...leads].sort((a, b) => compareBands(String(b.revenue), String(a.revenue)));
    } else if (paidSort !== "none") {
      leads = [...leads].sort((a, b) => {
        const ap = purchasePrices[a.id] ?? -Infinity; // undefined go last in asc
        const bp = purchasePrices[b.id] ?? -Infinity;
        return paidSort === "asc" ? ap - bp : bp - ap;
      });
    }
    return leads;
  }, [allLeads, revFilter.min, revFilter.max, revFilter.locationQuery, revFilter.sort, paidSort, purchasePrices]);

  const handleExportAll = async () => {
    if (purchasedLeads.length === 0) {
      ToastBus.csvNoneToExport();
      return;
    }
    setIsExporting(true);
    ToastBus.csvGenerating();
    try {
      const res = await fetch('/api/leads/export');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Falha ao exportar');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus_leads_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      ToastBus.csvSuccess();
    } catch (error) {
      ToastBus.csvError('Ocorreu um erro ao gerar o arquivo CSV.');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDemoLead = async () => {
    const chosen = (demoWonLeads && demoWonLeads.length > 0) ? demoWonLeads[0] : (demoLead || null);
    if (!chosen) return;
    try {
      const l = chosen as unknown as Lead;
      const headers = [
        'id', 'name', 'contact_name', 'email', 'phone', 'state', 'city', 'revenue', 'marketing_investment', 'status', 'expires_at', 'demo_price'
      ];
      const row = [
        l.id,
        l.name || '',
        l.contact_name || '',
        l.email || '',
        l.phone || '',
        l.state || '',
        l.city || '',
        String(l.revenue ?? ''),
        String(l.marketing_investment ?? ''),
        l.status || '',
        l.expires_at || '',
        String((chosen as unknown as { demo_price?: number }).demo_price ?? '')
      ].map((v) => String(v).replace(/"/g, '""'));
      const csv = `\uFEFF${headers.join(',')}\n"${row.join('","')}"`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `demo_lead_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      ToastBus.csvSuccess();
    } catch {
      ToastBus.csvError('Falha ao exportar demo lead.');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-foreground">
            Meus Leads Comprados
          </h2>
          <p className="text-muted-foreground">
            Leads que você adquiriu nos leilões
          </p>
        </div>
        {(allLeads.length > 0) && (
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-600">
                {allLeads.length}
              </div>
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                leads comprados
              </div>
            </div>
            {purchasedLeads.length > 0 && (
              <Button
                onClick={handleExportAll}
                disabled={isExporting}
                className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black shadow-md transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exportando..." : "Exportar Tudo (.csv)"}
              </Button>
            )}
            {(demoWonLeads && demoWonLeads.length > 0) && (
              <Button
                onClick={handleExportDemoLead}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Demo (.csv)
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      {purchasedLeads.length > 0 && (
        <div className="mt-2">
          <RevenueFilterSort
            value={revFilter}
            onChange={setRevFilter}
            availableStateUFs={availableStateUFs}
            includePaidSort
            paidSort={paidSort}
            onPaidSortChange={setPaidSort}
          />
        </div>
      )}

      {allLeads.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {displayLeads.map((purchasedLead) => {
            const validDateSource =
              purchasedLead.updated_at || purchasedLead.expires_at;
            const purchaseDate =
              validDateSource && typeof validDateSource === "string"
                ? new Date(validDateSource)
                : new Date();
            const isDemo = (demoWonLeads || []).some(d => d.id === purchasedLead.id);
            const price = isDemo ? (demoWonLeads.find(d => d.id === purchasedLead.id)?.demo_price ?? undefined) : (loadingPrices ? undefined : purchasePrices[purchasedLead.id]);
            return (
              <PurchasedLeadCard
                key={purchasedLead.id}
                lead={purchasedLead}
                purchaseDate={purchaseDate}
                purchasePrice={price}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-card text-card-foreground">
          <FiShoppingBag className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <div className="text-muted-foreground text-lg mb-2">
            Nenhum lead comprado ainda
          </div>
          <p className="text-muted-foreground">
            Participe dos leilões para adquirir leads qualificados
          </p>
        </div>
      )}
    </>
  );
}
