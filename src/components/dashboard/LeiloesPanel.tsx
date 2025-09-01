import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import StatsCards from "./leiloes/statsCards";
import { Clock, TrendingUp, Users } from "lucide-react";
import { LeadCard } from "./leiloes/LeadCard";
import { AuctionModal } from "./leiloes/AuctionModal";
import type { AuctionWithLead, Bid } from "./leiloes/types";
import { useRealtimeStore } from "@/store/realtime-store";
import type { RealtimeState } from "@/store/realtime-store";


// Tipagem para um Leilão que inclui os dados do Lead aninhados
type AuctionWithLeadLocal = AuctionWithLead;

export default function LeiloesPanel() {
    const { data: session } = useSession();
    const activeAuctions = useRealtimeStore((s: RealtimeState) => s.activeAuctions) as AuctionWithLeadLocal[];
    const bidsByAuction = useRealtimeStore((s: RealtimeState) => s.bidsByAuction) as Record<string, Bid[]>;
    const removeAuctionById = useRealtimeStore((s: RealtimeState) => s.removeAuctionById);
    const [selectedAuction, setSelectedAuction] = useState<AuctionWithLeadLocal | null>(null);

    const handleExpire = (auctionId: string) => {
        // Remove o leilão da lista quando o timer expira e solicita fechamento no backend
        removeAuctionById(auctionId);
        fetch(`/api/auctions/${auctionId}/close`, { method: 'POST' })
            .then(async (res) => {
                const json = await res.json().catch(() => ({}))
                console.log('[LeiloesPanel] close result:', res.status, json)
            })
            .catch((e) => console.error('[LeiloesPanel] close request failed:', e))
    };

    const user = { id: session?.user?.id, name: session?.user?.name || "Você" };

    // Calcula os stats com base nos leilões ativos
    const totalValue = useMemo(() => activeAuctions.reduce((sum, auction) => sum + (auction.leads.currentBid || 0), 0), [activeAuctions]);
    const activeAuctionsCount = activeAuctions.length;
    const totalBidders = useMemo(() => activeAuctions.reduce((sum, auction) => sum + (auction.leads.bidders || 0), 0), [activeAuctions]);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCards title="Leilões Ativos" icon={<Clock />} contentTitle={activeAuctionsCount.toString()} contentDescription="leads disponíveis agora" />
                <StatsCards title="Valor Total" icon={<TrendingUp />} contentTitle={totalValue.toLocaleString('pt-BR')} contentDescription="em leads disponíveis" />
                <StatsCards title="Participantes" icon={<Users />} contentTitle={totalBidders.toString()} contentDescription="lances realizados" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                {/* Mapeia a lista de leilões */}
                {activeAuctions.map((auction) => (
                    <LeadCard
                        key={auction.id} // A chave agora é o ID do leilão
                        lead={auction.leads} // Passa o objeto aninhado 'leads'
                        onExpire={() => handleExpire(auction.id)}
                        onSelect={() => setSelectedAuction(auction)}
                    />
                ))}
            </div>

            {activeAuctions.length === 0 && (
                <div className="text-center py-12 col-span-full">
                    <div className="text-gray-400 text-lg mb-2">Nenhum leilão ativo no momento</div>
                    <p className="text-gray-500">Aguarde novos leads</p>
                </div>
            )}
            {selectedAuction && (
                <AuctionModal
                    auctionId={selectedAuction.id}
                    lead={selectedAuction.leads} // Passa o lead do leilão selecionado
                    user={user}
                    initialBids={bidsByAuction[selectedAuction.id]}
                    onClose={() => setSelectedAuction(null)}
                />
            )}
        </>
    );
}