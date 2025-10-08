"use client";

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
        ): AuctionWithLead => ({
            id,
            status: "open",
            expired_at: new Date(now + minutes * 60 * 1000).toISOString(),
            minimum_bid: (status === "hot" ? 800 : 400),
            leads: {
                id: `demo-${id}`,
                name: (status === "hot" ? "Lead Hot Demo" : "Lead Demo"),
                description: "Lead demonstrativo",
                status,
                expires_at: new Date(now + minutes * 60 * 1000).toISOString(),
                location: "São Paulo",
                city: "São Paulo",
                channel: "Demo",
                revenue: (status === "hot" ? "De 250 mil até 400 mil" : "De 40 mil até 60 mil"),
                marketing_investment: (status === "hot" ? "4.001 a 10.000 por mês" : "1.201 a 2.500 por mês"),
                company_name: (status === "hot" ? "Global Trade" : "Nexus Health"),
                contact_name: (status === "hot" ? "Patrícia Oliveira" : "Rafael Santos"),
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
                document_url: (status === "hot" ? "https://example.com/documento-demo.pdf" : ""),
                contract_url: (status === "hot" ? "https://example.com/contrato-demo.pdf" : ""),
                cal_url: (status === "hot" ? "https://example.com/gravacao-demo.mp4" : undefined),
                contract_time: (status === "hot" && "1 ano"),
                contract_value: (status === "hot" && 100000),
                briefing_url: (status === "hot" ? "https://example.com/briefing-demo.pdf" : ""),
                tags: [],
            } as unknown as AuctionWithLead["leads"],
        });

        const hot = mk("demo-hot", "hot", 1);
        const cold = mk("demo-cold", "cold", 5);
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


