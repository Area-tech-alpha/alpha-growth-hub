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
        info("Novo leilão", name ? `"${name}" disponível para lances.` : undefined, `auction:new:${auctionId}`, 5000),

    notifyAuctionWon: (auctionId: string) =>
        success("Parabéns! Você ganhou o leilão!", "Veja o lead em Meus Leads.", `auction:won:${auctionId}`, 5000),

    notifyAuctionLost: (auctionId: string) =>
        info("Leilão encerrado", "Outro usuário venceu. Seus créditos retornaram.", `auction:lost:${auctionId}`, 5000),

    notifyAuctionExpired: (auctionId: string) =>
        info("Leilão expirado", "Processando o resultado final do leilão...", `auction:expired:${auctionId}`, 3000),

    notifyNewBidOnParticipatingAuction: (auctionId: string, amount?: number) =>
        info("Novo lance no leilão", amount ? `Novo lance de R$ ${Math.floor(amount)}` : undefined, `auction:newbid:${auctionId}`, 3000),

    notifyAuctionEndingSoon: (auctionId: string, secondsLeft: number = 60) =>
        info("Atenção: leilão terminando", `Faltam ${secondsLeft} segundos para encerrar.`, `auction:ending:${auctionId}`, 60000),

    bidSuccess: (amount: number) =>
        success("Lance realizado com sucesso!", `Seu lance de R$ ${Math.floor(amount)} foi registrado.`),
    bidInvalid: (currentBid: number) =>
        error("Lance inválido", `Seu lance deve ser maior que R$ ${Math.floor(currentBid)}.`),
    bidTooLow: (minimum: number) =>
        error("Lance muito baixo", `O lance mínimo é R$ ${Math.floor(minimum)}.`),
    bidInsufficientCredits: (needed: number) =>
        error("Créditos insuficientes", `Você precisa de pelo menos R$ ${Math.floor(needed)} em créditos.`),
    bidAuctionClosed: () =>
        error("Leilão encerrado", "Não é possível enviar lances após o término."),
    bidFailed: (message?: string) =>
        error("Falha ao enviar lance", message || "Tente novamente."),

    checkoutLoginRequired: () =>
        error("Ação necessária", "Você precisa estar logado para comprar créditos."),
    checkoutRedirecting: () =>
        success("Redirecionando para o pagamento...", "Você será levado para a página de checkout."),
    checkoutFailed: (message?: string) =>
        error("Falha ao iniciar pagamento", message),

    csvPreparing: () => info("Preparando seu arquivo CSV..."),
    csvGenerating: () => info("Gerando seu arquivo CSV..."),
    csvDownloadStarted: () => success("Download iniciado!"),
    csvSuccess: () => success("Exportação concluída!"),
    csvNoneToExport: () => error("Nenhum lead para exportar."),
    csvError: (message?: string) => error("Erro ao exportar", message),
};


