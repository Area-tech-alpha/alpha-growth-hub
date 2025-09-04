"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Phone,
    Mail,
    Zap,
    AlertCircle,
    Megaphone,
    DollarSign,
    Coins,
    User,
} from "lucide-react";
import { CountdownTimer } from "../leads/CountdownTimer";
import { Lead } from "../leads/types";
import { Bid } from "./types";
import { ToastBus } from "@/lib/toastBus";
import { useRealtimeStore } from "@/store/realtime-store";

import { maskEmail, maskName, maskPhone } from "@/lib/mask";

interface AuctionModalProps {
    auctionId: string;
    lead: Lead;
    onClose: () => void;
    user: { id?: string; name: string };
    initialBids?: Bid[];
}

const supabase = createClient();

export const AuctionModal = ({
    auctionId,
    lead,
    onClose,
    user,
    initialBids,
}: AuctionModalProps) => {
    const [isAuctionActive, setIsAuctionActive] = useState(
        new Date(lead.expires_at).getTime() > Date.now()
    );
    const [bidAmount, setBidAmount] = useState("");

    const [currentBid, setCurrentBid] = useState(lead.currentBid ?? 0);
    const [bids, setBids] = useState<Bid[]>(initialBids || []);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasWon, setHasWon] = useState(false);
    const userCredits = useRealtimeStore((s) => s.userCredits);
    const setHeldCredits = useRealtimeStore((s) => s.setHeldCredits);
    const rawUserCredits = useRealtimeStore((s) => s.rawUserCredits);
    const handleBidAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const onlyNums = /^[0-9]*$/;
        if (value === "") {
            setBidAmount("");
            return;
        }
        if (onlyNums.test(value)) {
            setBidAmount(value);
        }
    };

    const handleExpire = () => {
        setIsAuctionActive(false);

        const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
        const lastBid = sortedBids[0];
        const currentUserId = user.id;
        if (currentUserId && lastBid && lastBid.userId === currentUserId) {
            setHasWon(true);
        }
    };

    useEffect(() => {
        if (initialBids && initialBids.length > 0) {
            const top = initialBids[0]?.amount ?? lead.currentBid ?? 0;
            setCurrentBid(top);
        }

        const channel = supabase
            .channel(`bids-auction-${auctionId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "bids",
                    filter: `auction_id=eq.${auctionId}`,
                },
                (payload: {
                    new: {
                        id: string;
                        user_id: string;
                        amount: number | string;
                        created_at: string;
                    };
                }) => {
                    const row = payload.new;
                    const amount =
                        typeof row.amount === "string"
                            ? parseFloat(row.amount)
                            : row.amount;
                    const bid: Bid = {
                        id: row.id,
                        leadId: lead.id,
                        userId: row.user_id,
                        userName: "Participante",
                        amount,
                        timestamp: new Date(row.created_at),
                    };
                    setBids((prev) => {
                        if (prev.some((b) => b.id === bid.id)) return prev;

                        return [bid, ...prev].sort((a, b) => b.amount - a.amount);
                    });
                    setCurrentBid((prev) => Math.max(prev ?? 0, amount || 0));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [auctionId, lead.id, lead.currentBid, initialBids]);

    const formatCurrency = (value: number | undefined | null) => {
        const numericValue = typeof value === "number" && !isNaN(value) ? value : 0;
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(numericValue);
    };

    const handleBid = async () => {
        if (!isAuctionActive) {
            ToastBus.bidAuctionClosed();
            return;
        }
        const amount = parseFloat(bidAmount);
        if (!amount || amount <= currentBid) {
            ToastBus.bidInvalid(currentBid);
            return;
        }
        if (amount < (lead.minimumBid as number)) {
            ToastBus.bidTooLow(lead.minimumBid as number);
            return;
        }
        if (amount > userCredits) {
            ToastBus.bidInsufficientCredits(amount);
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auction/bid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ auction_id: auctionId, amount }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json?.error || "Falha ao registrar o lance");
            }
            if (typeof json?.availableCredits === "number") {
                const nextHeld = Math.max(0, Number(rawUserCredits || 0) - Number(json.availableCredits));
                setHeldCredits(nextHeld);
            }
            setBidAmount("");
            ToastBus.bidSuccess(amount);
        } catch (e) {
            const message = (e as { message?: string })?.message || String(e);
            console.error("[AuctionModal] Insert bid error:", message);
            ToastBus.bidFailed(message || "Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-10">
                        <DialogTitle className="text-2xl font-bold text-yellow-600">
                            {lead.name}
                        </DialogTitle>
                        <CountdownTimer
                            expiresAt={lead.expires_at}
                            onExpire={handleExpire}
                            className="text-2xl"
                        />
                    </div>
                    <DialogDescription className="text-muted-foreground">
                        {lead.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">
                            {hasWon ? "Informações Completas do Lead" : "Prévia do Lead"}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    <span className="text-sm">Faturamento</span>
                                </div>
                                <div className="font-bold text-xl">
                                    {formatCurrency(lead.revenue)}
                                </div>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                    <Megaphone className="h-4 w-4" />
                                    <span className="text-sm">Invest. Marketing</span>
                                </div>
                                <div className="font-bold text-xl">
                                    {formatCurrency(lead.marketingInvestment)}
                                </div>
                            </div>
                        </div>

                        <div
                            className={`p-4 rounded-lg ${hasWon ? "bg-green-50 dark:bg-green-900/20" : "bg-muted"
                                }`}
                        >
                            <h4 className="font-medium mb-3">Informações de Contato</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3">
                                    <User className="h-4 w-4 flex-shrink-0" />
                                    <span>
                                        {hasWon ? lead.contactName : maskName(lead.contactName)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 flex-shrink-0" />
                                    <span>{hasWon ? lead.phone : maskPhone(lead.phone)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 flex-shrink-0" />
                                    <span>{hasWon ? lead.email : maskEmail(lead.email)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Coluna da Direita - Lances */}
                    <div className="space-y-6">
                        {isAuctionActive && !hasWon && (
                            <div className="p-4 border rounded-lg space-y-4">
                                <h3 className="text-lg font-semibold">Fazer Lance</h3>
                                <div className="p-3 bg-muted rounded-lg text-sm flex items-center gap-2">
                                    <Coins className="h-4 w-4" />
                                    Seus créditos: <strong>{formatCurrency(userCredits)}</strong>
                                </div>
                                <div className="text-sm flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Lance mínimo:{" "}
                                    <strong>
                                        {formatCurrency(
                                            Math.max((currentBid ?? 0) + 1, lead.minimumBid as number)
                                        )}
                                    </strong>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="Seu lance"
                                        value={bidAmount}
                                        onChange={handleBidAmountChange}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleBid}
                                        disabled={isSubmitting}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                                    >
                                        <Zap className="h-4 w-4 mr-2" />
                                        {isSubmitting ? "Enviando..." : "Dar Lance"}
                                    </Button>
                                </div>
                            </div>
                        )}
                        {!isAuctionActive && (
                            <div className="p-6 bg-muted rounded-lg text-center">
                                <h3 className="text-lg font-semibold mb-2">
                                    {hasWon ? "Leilão Ganho!" : "Leilão Encerrado"}
                                </h3>
                                <p className="text-muted-foreground">
                                    {hasWon
                                        ? "Parabéns! As informações do lead estão liberadas."
                                        : "Este leilão foi finalizado."}
                                </p>
                            </div>
                        )}
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Histórico de Lances</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {bids.length > 0 ? (
                                    bids.map((bid, index) => (
                                        <div
                                            key={bid.id}
                                            className={`p-3 rounded-lg border flex justify-between items-center ${index === 0
                                                ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"
                                                : "bg-muted"
                                                }`}
                                        >
                                            <div className="font-bold text-yellow-600">
                                                {formatCurrency(bid.amount)}
                                            </div>
                                            <div className="text-right">
                                                {index === 0 && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="bg-yellow-100 text-yellow-800 text-xs mb-1"
                                                    >
                                                        Maior lance
                                                    </Badge>
                                                )}
                                                <div className="text-xs text-muted-foreground">
                                                    {bid.timestamp.toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Nenhum lance ainda.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6">
                    <Button variant="outline" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}