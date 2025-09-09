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

const escapeCsvCell = (
  cellData: string | number | null | undefined
): string => {
  if (cellData === null || cellData === undefined) {
    return '""';
  }
  const stringData = String(cellData);
  if (/[",\n\r]/.test(stringData)) {
    return `"${stringData.replace(/"/g, '""')}"`;
  }
  return `"${stringData}"`;
};

export default function MeusLeadsPanel() {
  const purchasedLeads = useRealtimeStore(
    (s: RealtimeState) => s.purchasedLeads
  ) as Lead[];
  const fetchUserLeads = useRealtimeStore((s) => s.fetchUserLeads);
  const subscribeToUserLeads = useRealtimeStore((s) => s.subscribeToUserLeads);
  const unsubscribeFromUserLeads = useRealtimeStore((s) => s.unsubscribeFromUserLeads);
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [isExporting, setIsExporting] = useState(false);
  const [purchasePrices, setPurchasePrices] = useState<Record<string, number>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [revFilter, setRevFilter] = useState<RevenueFilterValue>({ sort: "none" });
  const [paidSort, setPaidSort] = useState<"none" | "asc" | "desc">("none");

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
        const leadIds = Array.from(new Set(purchasedLeads.map(l => l.id)));
        if (leadIds.length === 0) { setPurchasePrices({}); return; }
        const res = await fetch('/api/leads/purchase-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds })
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
  }, [purchasedLeads]);

  // Compute available states based on current revenue filter (min/max)
  const availableStateUFs = useMemo(() => {
    let leads = purchasedLeads.slice();
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
  }, [purchasedLeads, revFilter.min, revFilter.max]);

  // Apply filters and sorting (revenue sort takes precedence if chosen; otherwise sort by paid)
  const displayLeads = useMemo(() => {
    let leads = purchasedLeads.slice();

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
  }, [purchasedLeads, revFilter.min, revFilter.max, revFilter.locationQuery, revFilter.sort, paidSort, purchasePrices]);

  const handleExportAll = () => {
    if (purchasedLeads.length === 0) {
      ToastBus.csvNoneToExport();
      return;
    }

    setIsExporting(true);
    ToastBus.csvGenerating();

    try {
      const headers = [
        "ID do Lead",
        "Nome da Empresa",
        "Nome do Contato",
        "Telefone",
        "Email",
        "Estado",
        "Cidade",
        "Nicho",
        "Faturamento Anual (R$)",
        "Investimento em Marketing (R$)",
        "Canal",
        "Data da Compra",
        "CNPJ",
      ];

      const rows = purchasedLeads.map((lead) => {
        const purchaseDateSource = lead.updated_at || lead.expires_at;
        const purchaseDate =
          purchaseDateSource && typeof purchaseDateSource === "string"
            ? new Date(purchaseDateSource).toLocaleString("pt-BR")
            : "N/A";

        return [
          escapeCsvCell(lead.id),
          escapeCsvCell(lead.company_name),
          escapeCsvCell(lead.contact_name),
          escapeCsvCell(lead.phone),
          escapeCsvCell(lead.email),
          escapeCsvCell(lead.state),
          escapeCsvCell(lead.city),
          escapeCsvCell(lead.niche),
          escapeCsvCell(lead.revenue),
          escapeCsvCell(lead.marketing_investment),
          escapeCsvCell(lead.channel),
          escapeCsvCell(purchaseDate),
          escapeCsvCell(lead.cnpj),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([`\uFEFF${csvContent}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `meus_leads_comprados_${new Date()
        .toLocaleDateString("pt-BR")
        .replace(/\//g, "-")}.csv`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      ToastBus.csvSuccess();
    } catch (error) {
      ToastBus.csvError("Ocorreu um erro ao gerar o arquivo CSV.");
      console.error(error);
    } finally {
      setIsExporting(false);
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
        {purchasedLeads.length > 0 && (
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-600">
                {purchasedLeads.length}
              </div>
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                leads comprados
              </div>
            </div>
            <Button
              onClick={handleExportAll}
              disabled={isExporting || purchasedLeads.length === 0}
              className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black shadow-md transition-all duration-200"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exportando..." : "Exportar Tudo (.csv)"}
            </Button>
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

      {purchasedLeads.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {displayLeads.map((purchasedLead) => {
            const validDateSource =
              purchasedLead.updated_at || purchasedLead.expires_at;
            const purchaseDate =
              validDateSource && typeof validDateSource === "string"
                ? new Date(validDateSource)
                : new Date();
            return (
              <PurchasedLeadCard
                key={purchasedLead.id}
                lead={purchasedLead}
                purchaseDate={purchaseDate}
                purchasePrice={loadingPrices ? undefined : purchasePrices[purchasedLead.id]}
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
