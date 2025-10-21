"use client";

import { toast } from "sonner";

type DedupeKey = string;

const lastShownAt = new Map<DedupeKey, number>();
const DEFAULT_DEDUPE_MS = 3000;

function shouldShow(key: DedupeKey, dedupeMs: number = DEFAULT_DEDUPE_MS): boolean {
    const now = Date.now();
    const last = lastShownAt.get(key) || 0;
    if (now - last < dedupeMs) return false;
    lastShownAt.set(key, now);
    return true;
}

function info(title: string, description?: string, key?: string, dedupeMs?: number) {
    if (key && !shouldShow(key, dedupeMs)) return;
    toast.info(title, description ? { description } : undefined);
}

function success(title: string, description?: string, key?: string, dedupeMs?: number) {
    if (key && !shouldShow(key, dedupeMs)) return;
    toast.success(title, description ? { description } : undefined);
}

function error(title: string, description?: string, key?: string, dedupeMs?: number) {
    if (key && !shouldShow(key, dedupeMs)) return;
    toast.error(title, description ? { description } : undefined);
}

export const ToastBus = {
    info,
    success,
    error,

    notifyNewAuction: (auctionId: string, name?: string) =>
        info(
            "Novo leilao aberto",
            name ? `"${name}" liberado para lances.` : "Acesse o painel para ver os detalhes.",
            `auction:new:${auctionId}`,
            5000
        ),

    notifyAuctionWon: (auctionId: string) =>
        success(
            "Parabens! Voce ganhou o leilao.",
            "Conclua o atendimento em Meus Leads.",
            `auction:won:${auctionId}`,
            5000
        ),

    notifyAuctionLost: (auctionId: string) =>
        info(
            "Leilao encerrado",
            "Outro usuario venceu. Seus creditos ja voltaram para a sua conta.",
            `auction:lost:${auctionId}`,
            5000
        ),

    notifyAuctionExpired: (auctionId: string) =>
        info(
            "Leilao expirado",
            "Estamos finalizando o processamento desse leilao.",
            `auction:expired:${auctionId}`,
            3000
        ),

    notifyNewBidOnParticipatingAuction: (auctionId: string, amount?: number) =>
        info(
            "Novo lance nesse leilao",
            amount ? `Novo lance registrado em R$ ${Math.floor(amount)}.` : undefined,
            `auction:newbid:${auctionId}`,
            3000
        ),

    notifyAuctionEndingSoon: (auctionId: string, secondsLeft: number = 60) =>
        info(
            "Atencao: leilao terminando",
            `Faltam ${secondsLeft} segundos para encerrar.`,
            `auction:ending:${auctionId}`,
            60000
        ),

    bidSuccess: (amount: number) =>
        success("Lance registrado!", `Seu lance de R$ ${Math.floor(amount)} entrou na fila.`),
    bidInvalid: (currentBid: number) =>
        error("Lance invalido", `Digite um valor acima de R$ ${Math.floor(currentBid)}.`),
    bidTooLow: (minimum: number) =>
        error("Lance muito baixo", `O lance minimo agora e R$ ${Math.floor(minimum)}.`),
    bidInsufficientCredits: (needed: number) =>
        error("Creditos insuficientes", `Voce precisa de pelo menos R$ ${Math.floor(needed)} livres em creditos.`),
    bidAuctionClosed: () =>
        error("Leilao encerrado", "Esse leilao nao aceita mais lances. Atualize a lista."),
    bidFailed: (message?: string) =>
        error("Nao foi possivel registrar o lance", message || "Tente novamente em alguns segundos."),

    buyNowSuccess: (amount?: number, leadName?: string) =>
        success(
            "Lead adquirido!",
            `${leadName ? `"${leadName}" - ` : ""}Compra confirmada por R$ ${Math.floor(Number(amount || 0))}.`
        ),

    checkoutLoginRequired: () =>
        error("Autenticacao necessaria", "Entre na conta para comprar creditos."),
    checkoutRedirecting: () =>
        success("Redirecionando para o pagamento...", "Vamos abrir o checkout agora."),
    checkoutFailed: (message?: string) =>
        error("Falha ao iniciar pagamento", message),

    csvPreparing: () => info("Preparando seu arquivo CSV..."),
    csvGenerating: () => info("Gerando seu arquivo CSV..."),
    csvDownloadStarted: () => success("Download iniciado!"),
    csvSuccess: () => success("Exportacao concluida!"),
    csvNoneToExport: () => error("Nenhum lead para exportar."),
    csvError: (message?: string) => error("Erro ao exportar", message),
};



