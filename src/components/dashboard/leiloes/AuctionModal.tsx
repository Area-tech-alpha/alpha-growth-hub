"use client";

import { useState, useEffect, useRef } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Phone,
    Mail,
    Zap,
    AlertCircle,
    Megaphone,
    DollarSign,
    Coins,
    User,
    Info,
    Hash,
    Clock,
} from "lucide-react";
import { CountdownTimer } from "../leads/CountdownTimer";
import { Lead } from "../leads/types";
import { Bid, AuctionWithLead, LeadForAuction } from "./types";
import { ToastBus } from "@/lib/toastBus";
import { useRealtimeStore } from "@/store/realtime-store";

import { maskEmail, maskName, maskPhone } from "@/lib/mask";

interface AuctionModalProps {
    auctionId: string;
    lead: Lead;
    onClose: () => void;
    user: { id?: string; name: string };
    onDemoWin?: (lead: Lead) => void;
}

const EMPTY_BIDS: Bid[] = [];

export const AuctionModal = ({
    auctionId,
    lead,
    onClose,
    user,
    onDemoWin,
}: AuctionModalProps) => {
    const [isAuctionActive, setIsAuctionActive] = useState(
        new Date(lead.expires_at).getTime() > Date.now()
    );
    const [bidAmount, setBidAmount] = useState("");

    const [currentBid, setCurrentBid] = useState(lead.currentBid ?? 0);
    const bidsFromStore = useRealtimeStore((s) => (s.bidsByAuction[auctionId] ?? EMPTY_BIDS)) as Bid[];
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasWon, setHasWon] = useState(false);
    const displayLeadName = lead.name;
    const demoModeActive = useRealtimeStore((s) => s.demoModeActive);
    const demoCredits = useRealtimeStore((s) => s.demoCredits);
    const demoHolds = useRealtimeStore((s) => s.demoHolds);
    const realUserCredits = useRealtimeStore((s) => s.userCredits);
    const activeAuctions = useRealtimeStore((s) => s.activeAuctions) as AuctionWithLead[];
    type UpdateFields = Partial<Omit<AuctionWithLead, 'leads'>> & { leads?: Partial<LeadForAuction> };
    const updateDemoAuctionFields = useRealtimeStore((s) => (s as unknown as { updateDemoAuctionFields: (id: string, f: UpdateFields) => void }).updateDemoAuctionFields) as (id: string, f: UpdateFields) => void;
    const isDemoAuction = auctionId.startsWith('demo-');
    const addDemoWonLead = useRealtimeStore((s) => (s as unknown as { addDemoWonLead: (l: LeadForAuction & { demo_price?: number }) => void }).addDemoWonLead) as (lead: LeadForAuction & { demo_price?: number }) => void;
    const demoAvailable = Math.max(0, demoCredits - Object.values(demoHolds || {}).reduce((a, b) => a + (Number(b) || 0), 0));
    const userCredits = demoModeActive && isDemoAuction ? demoAvailable : realUserCredits;
    const setDemoHold = useRealtimeStore((s) => s.setDemoHold);
    const setHeldCredits = useRealtimeStore((s) => s.setHeldCredits);
    const rawUserCredits = useRealtimeStore((s) => s.rawUserCredits);
    const addBidForAuction = useRealtimeStore((s) => s.addBidForAuction);
    const updateAuctionStatsFromBid = useRealtimeStore((s) => s.updateAuctionStatsFromBid);
    const [userMaskedEmails, setUserMaskedEmails] = useState<Record<string, string>>({});
    const userEmailsRef = useRef<Record<string, string>>({});
    const auctionFromStore = activeAuctions.find((a: AuctionWithLead) => a.id === auctionId);
    const auctionMinimumBid = auctionFromStore?.minimum_bid;
    let requiredMin = Math.max(
        Number.isFinite(auctionMinimumBid as number) ? (auctionMinimumBid as number) : 0,
        (currentBid ?? 0) + 1,
        lead.minimum_value || 0
    );
    let buyNowPrice = Math.ceil(requiredMin * 1.5);
    // Regras específicas para DEMO: mínimos fixos iniciais e progressão 1.1x/1.5x do último lance fake
    if (isDemoAuction) {
        const baseline = lead.status === 'hot' ? 800 : 400;
        const last = Number(currentBid || 0);
        const nextMinFromLast = last > 0 ? Math.ceil(last * 1.10) : baseline;
        requiredMin = Math.max(baseline, nextMinFromLast);
        const baseForBuy = last > 0 ? last : baseline;
        buyNowPrice = Math.ceil(baseForBuy * 1.5);
    }
    const [confirmBuyNowOpen, setConfirmBuyNowOpen] = useState(false);
    const handleBidAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawDigits = e.target.value.replace(/\D/g, "");
        setBidAmount(rawDigits);
    };

    const formatNumberInput = (raw: string) => {
        if (!raw) return "";
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return "";
        return n.toLocaleString("pt-BR");
    };

    const handleExpire = () => {
        setIsAuctionActive(false);

        const currentUserId = user.id;
        const userParticipated = bidsFromStore.some(b => b.userId === currentUserId);
        if (isDemoAuction && userParticipated) {
            setHasWon(true);
            try { onDemoWin?.(lead); } catch { }
            try { addDemoWonLead({ ...(lead as LeadForAuction), demo_price: currentBid || 0 }); } catch { }
        } else if (!isDemoAuction) {
            const sortedBids = [...bidsFromStore].sort((a, b) => b.amount - a.amount);
            const lastBid = sortedBids[0];
            if (currentUserId && lastBid && lastBid.userId === currentUserId) {
                setHasWon(true);
            }
        }
        onClose();
    };

    useEffect(() => {
        const top = bidsFromStore && bidsFromStore.length > 0
            ? bidsFromStore[0]?.amount
            : (lead.currentBid ?? 0);
        setCurrentBid((prev) => (prev !== top ? top : prev));
    }, [bidsFromStore, lead.currentBid]);

    useEffect(() => {
        const loadMissing = async () => {
            try {
                const ids = Array.from(new Set(bidsFromStore.map(b => b.userId).filter(Boolean)));
                const missing = ids.filter((id) => !userEmailsRef.current[id]);
                if (missing.length === 0) return;
                const res = await fetch('/api/users/masked-emails', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: missing })
                });
                const json = await res.json();
                const emails: Record<string, string> = (json?.emails || {}) as Record<string, string>;
                if (Object.keys(emails).length > 0) {
                    const maskedMap: Record<string, string> = {};
                    Object.entries(emails).forEach(([id, email]) => {
                        maskedMap[id] = maskEmail(String(email));
                    });
                    userEmailsRef.current = { ...userEmailsRef.current, ...maskedMap };
                    setUserMaskedEmails((m) => ({ ...m, ...maskedMap }));
                }
            } catch { }
        };
        loadMissing();
    }, [bidsFromStore]);

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
        const amount = Number(bidAmount || "0");
        if (!amount || amount < requiredMin) {
            ToastBus.bidTooLow(requiredMin);
            return;
        }
        const isDemo = isDemoAuction;
        if (!isDemo && amount > userCredits) {
            ToastBus.bidInsufficientCredits(amount);
            return;
        }
        setIsSubmitting(true);
        try {
            if (isDemo) {
                const bid: Bid = {
                    id: `demo-bid-${Date.now()}`,
                    leadId: lead.id,
                    userId: user.id || 'demo-user',
                    userName: user.name || 'Você',
                    amount,
                    timestamp: new Date(),
                };
                addBidForAuction(auctionId, bid);
                updateAuctionStatsFromBid(auctionId, amount);
                // Segue a mesma regra do real: próximo lance mínimo = ceil(lance * 1.10)
                const nextMinimum = Math.ceil(amount * 1.10);
                updateDemoAuctionFields(auctionId, { minimum_bid: nextMinimum });
                // Anti-sniping demo: se faltar 31–60s, volta para 60s; se 0–30s, volta para 30s
                try {
                    const nowMs = Date.now();
                    const expSrc = auctionFromStore?.expired_at || lead.expires_at;
                    const expMs = new Date(expSrc).getTime();
                    const remainingMs = expMs - nowMs;
                    if (Number.isFinite(remainingMs) && remainingMs <= 60_000) {
                        const extendToMs = remainingMs > 30_000 ? 60_000 : 30_000;
                        const newExpiryIso = new Date(nowMs + extendToMs).toISOString();
                        // Atualiza auction e também leads.expires_at (store já reflete, mas forçamos aqui também para o modal)
                        updateDemoAuctionFields(auctionId, { expired_at: newExpiryIso, leads: { expires_at: newExpiryIso } });
                    }
                } catch { }
                setDemoHold(auctionId, amount);
                setBidAmount("");
                ToastBus.bidSuccess(amount);
                return;
            }
            const idemKey = `${user.id || 'anon'}:${auctionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
            const res = await fetch("/api/auction/bid", {
                method: "POST",
                headers: { "Content-Type": "application/json", "idempotency-key": idemKey },
                body: JSON.stringify({ auction_id: auctionId, amount, idempotency_key: idemKey }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 402) {
                    ToastBus.bidInsufficientCredits(amount);
                    return;
                }
                if (res.status === 409) {
                    ToastBus.bidFailed(String(json?.error || 'Outra ação está em processamento. Tente novamente.'));
                    return;
                }
                if (res.status === 400) {
                    ToastBus.bidFailed(String(json?.error || 'Parâmetros inválidos'));
                    return;
                }
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

    const contractValue = (lead as unknown as { contract_value?: number })?.contract_value;
    const contractTime = (lead as unknown as { contract_time?: string })?.contract_time;

    const handleBuyNow = async () => {
        // Abre confirmação em vez de executar direto
        setConfirmBuyNowOpen(true);
    };

    const executeBuyNow = async () => {
        if (!isAuctionActive) {
            ToastBus.bidAuctionClosed();
            setConfirmBuyNowOpen(false);
            return;
        }
        const buyNowAmount = buyNowPrice;
        const isDemo = isDemoAuction;
        if (!isDemo && buyNowAmount > userCredits) {
            ToastBus.bidInsufficientCredits(buyNowAmount);
            setConfirmBuyNowOpen(false);
            return;
        }
        setIsSubmitting(true);
        try {
            if (isDemo) {
                const bid: Bid = {
                    id: `demo-bid-${Date.now()}`,
                    leadId: lead.id,
                    userId: user.id || 'demo-user',
                    userName: user.name || 'Você',
                    amount: buyNowAmount,
                    timestamp: new Date(),
                };
                addBidForAuction(auctionId, bid);
                updateAuctionStatsFromBid(auctionId, buyNowAmount);
                setDemoHold(auctionId, buyNowAmount);
                setHasWon(true);
                ToastBus.buyNowSuccess(buyNowAmount, lead.name);
                try {
                    window.dispatchEvent(new CustomEvent('demo-auction-closed', { detail: { id: auctionId } }));
                } catch { }
                try { onDemoWin?.(lead); } catch { }
                try { addDemoWonLead({ ...(lead as LeadForAuction), demo_price: buyNowAmount }); } catch { }
                onClose();
                setConfirmBuyNowOpen(false);
                return;
            }
            const idemKey = `${user.id || 'anon'}:${auctionId}:buy:${Date.now()}:${Math.random().toString(36).slice(2)}`;
            const res = await fetch("/api/auction/bid", {
                method: "POST",
                headers: { "Content-Type": "application/json", "idempotency-key": idemKey },
                body: JSON.stringify({ auction_id: auctionId, amount: buyNowAmount, buy_now: true, idempotency_key: idemKey }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 402) {
                    ToastBus.bidInsufficientCredits(buyNowAmount);
                    setConfirmBuyNowOpen(false);
                    return;
                }
                if (res.status === 409) {
                    ToastBus.bidFailed(String(json?.error || 'Outra ação está em processamento. Tente novamente.'));
                    setConfirmBuyNowOpen(false);
                    return;
                }
                if (res.status === 400) {
                    ToastBus.bidFailed(String(json?.error || 'Parâmetros inválidos'));
                    setConfirmBuyNowOpen(false);
                    return;
                }
                throw new Error(json?.error || "Falha ao comprar já");
            }
            if (typeof json?.availableCredits === "number") {
                const nextHeld = Math.max(0, Number(rawUserCredits || 0) - Number(json.availableCredits));
                setHeldCredits(nextHeld);
            }
            setHasWon(true);
            ToastBus.buyNowSuccess(buyNowAmount, lead.name);
            onClose();
            // Remoção otimista do leilão da lista
            try { useRealtimeStore.getState().removeAuctionById(auctionId); } catch { }
            setConfirmBuyNowOpen(false);
        } catch (e) {
            const message = (e as { message?: string })?.message || String(e);
            console.error("[AuctionModal] BuyNow error:", message);
            ToastBus.bidFailed(message || "Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const mainDialog = (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-10">
                        <DialogTitle className="text-2xl font-bold text-yellow-600">
                            {displayLeadName}
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
                                <div className="font-bold text-base sm:text-xl truncate" title={String(lead.revenue)}>
                                    {String(lead.revenue)}
                                </div>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                    <Megaphone className="h-4 w-4" />
                                    <span className="text-sm">Invest. Marketing</span>
                                </div>
                                <div className="font-bold text-base sm:text-xl truncate" title={String(lead.marketing_investment)}>
                                    {String(lead.marketing_investment)}
                                </div>
                            </div>
                            {typeof contractValue === "number" && !isNaN(contractValue) && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign className="h-4 w-4" />
                                        <span className="text-sm">Valor do Contrato</span>
                                    </div>
                                    <div className="font-bold text-base sm:text-xl truncate">
                                        {formatCurrency(contractValue)}
                                    </div>
                                </div>
                            )}
                            {contractTime && (
                                <div className="p-4 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-sm">Tempo de Contrato</span>
                                    </div>
                                    <div className="font-bold text-base sm:text-xl truncate" title={String(contractTime)}>
                                        {contractTime}
                                    </div>
                                </div>
                            )}
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
                                        {hasWon ? lead.contact_name : maskName(lead.contact_name)}
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
                                <div className="flex items-center gap-3">
                                    <Hash className="h-4 w-4 flex-shrink-0" />
                                    <span>{(lead as unknown as { cnpj?: string })?.cnpj}</span>
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
                                <TooltipProvider delayDuration={200} disableHoverableContent>
                                    <div className="text-xs text-muted-foreground -mt-2 flex items-start gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="inline-flex items-center sm:cursor-help">
                                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                                </span>
                                            </TooltipTrigger>
                                            {/* Esconde tooltip em mobile (sm:hidden) */}
                                            <TooltipContent className="hidden sm:block max-w-xs">
                                                Encerrar o leilão agora pagando 1,5× do lance mínimo. O lead é transferido imediatamente e os créditos são debitados.
                                            </TooltipContent>
                                        </Tooltip>
                                        <div>
                                            <span className="mr-1">Comprar já:</span>
                                            <strong className="text-yellow-600">{formatCurrency(buyNowPrice)}</strong>
                                            <span className="hidden sm:inline"> (1,5× do lance mínimo)</span>
                                            <span className="block sm:hidden text-muted-foreground/90">(1,5× do lance mínimo)</span>
                                        </div>
                                    </div>
                                </TooltipProvider>
                                <div className="flex flex-col gap-2">
                                    <Button
                                        onClick={handleBuyNow}
                                        disabled={isSubmitting}
                                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold shadow w-full mb-6"
                                        title={`Comprar já! (${formatCurrency(buyNowPrice)} = 1,5× do lance mínimo)`}
                                    >
                                        Comprar já!
                                    </Button>
                                    <div className="text-sm flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        Lance mínimo:{" "}
                                        <strong>{formatCurrency(requiredMin)}</strong>
                                    </div>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="Seu lance"
                                        value={formatNumberInput(bidAmount)}
                                        onChange={handleBidAmountChange}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleBid}
                                        disabled={isSubmitting}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold w-full"
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
                                {bidsFromStore.length > 0 ? (
                                    bidsFromStore.map((bid, index) => (
                                        <div
                                            key={bid.id}
                                            className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:justify-between items-start sm:items-center min-w-0 ${index === 0
                                                ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"
                                                : "bg-muted"
                                                }`}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <div className="font-bold text-yellow-600">
                                                    {formatCurrency(bid.amount)}
                                                </div>
                                                <div className="text-xs text-muted-foreground min-h-[1rem] flex items-center overflow-hidden">
                                                    {userMaskedEmails[bid.userId] ? (
                                                        <span className="truncate" title={userMaskedEmails[bid.userId]}>
                                                            {userMaskedEmails[bid.userId]}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block h-3 w-24 rounded bg-muted animate-pulse" />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right w-full sm:w-auto mt-2 sm:mt-0">
                                                {index === 0 && (
                                                    <div className="flex items-center justify-end gap-2 mb-1 flex-wrap">
                                                        <Badge
                                                            variant="secondary"
                                                            className="bg-yellow-100 text-yellow-800 text-xs"
                                                        >
                                                            Maior lance
                                                        </Badge>
                                                        {bid.userId === (user.id || '') && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="bg-green-100 text-green-800 text-xs"
                                                            >
                                                                Seu lance!
                                                            </Badge>
                                                        )}
                                                    </div>
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

    const confirmDialog = (
        confirmBuyNowOpen && (
            <Dialog open={confirmBuyNowOpen} onOpenChange={setConfirmBuyNowOpen} key="confirm-buynow">
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar Comprar já</DialogTitle>
                        <DialogDescription>
                            Ao confirmar, o leilão será encerrado imediatamente e o lead será adquirido na hora. Serão debitados {formatCurrency(buyNowPrice)} dos seus créditos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 justify-end pt-2">
                        <Button variant="outline" onClick={() => setConfirmBuyNowOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black" onClick={executeBuyNow} disabled={isSubmitting}>
                            Confirmar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        )
    );

    return <>{mainDialog}{confirmDialog}</>;
}


