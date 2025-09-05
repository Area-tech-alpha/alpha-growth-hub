"use client";

import { Lead } from "../leads/types";
import type { AuctionWithLead } from "./types";
import { useRealtimeStore } from "@/store/realtime-store";

export default function DemoAuctionsButton({
    visible,
    onCreate,
}: {
    visible: boolean;
    onCreate: (auctions: AuctionWithLead[]) => void;
}) {
    const setDemoModeActive = useRealtimeStore((s) => s.setDemoModeActive);
    const setDemoCredits = useRealtimeStore((s) => s.setDemoCredits);

    if (!visible) return null;

    const handleClick = () => {
        const now = Date.now();
        const mk = (
            id: string,
            status: "hot" | "cold",
            minutes: number,
            lead: Partial<AuctionWithLead["leads"]>
        ): AuctionWithLead => ({
            id,
            status: "open",
            expired_at: new Date(now + minutes * 60 * 1000).toISOString(),
            leads: {
                id: `demo-${id}`,
                name: (lead.company_name as string) || "Lead Demo",
                description: lead.description || "Lead demonstrativo",
                status,
                expires_at: new Date(now + minutes * 60 * 1000).toISOString(),
                location: lead.location || "São Paulo",
                channel: "Demo",
                revenue: (lead as Lead)?.revenue ?? (status === "hot" ? 5_000_000 : 1_200_000),
                marketing_investment:
                    (lead as Lead)?.marketing_investment ?? (status === "hot" ? 500_000 : 150_000),
                company_name: (lead as Lead)?.company_name || (status === "hot" ? "Global Trade" : "Nexus Health"),
                contact_name: (lead as Lead)?.contact_name || (status === "hot" ? "Patrícia Oliveira" : "Rafael Santos"),
                cnpj: "00.000.000/0000-00",
                phone: "(11) 99999-9999",
                email: "demo@empresa.com",
                maskedCompanyName: "",
                niche: "Geral",
                maskedContactName: "",
                maskedPhone: "",
                maskedEmail: "",
                currentBid: 0,
                bidders: 0,
                category: "Demo",
                tags: [],
            } as unknown as AuctionWithLead["leads"],
        });

        const hot = mk("demo-hot", "hot", 1, { company_name: "Global Trade", location: "São Paulo" });
        const cold = mk("demo-cold", "cold", 1, { company_name: "Nexus Health", location: "Rio de Janeiro" });
        // Hot primeiro
        onCreate([hot, cold]);
        setDemoModeActive(true);
        setDemoCredits(5000);
    };

    return (
        <div className="mt-6 flex justify-center">
            <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2 text-black shadow hover:from-yellow-500 hover:to-yellow-600"
                onClick={handleClick}
            >
                Adicionar leilões de demonstração
            </button>
        </div>
    );
}


