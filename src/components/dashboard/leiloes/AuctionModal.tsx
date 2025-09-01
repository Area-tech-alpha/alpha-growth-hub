"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Building,
  User,
  Target,
  Megaphone,
  DollarSign,
  Coins,
} from "lucide-react";
import { CountdownTimer } from "../leads/CountdownTimer";
import { toast } from "sonner";
import { fetchBidsForAuction, postBid } from "@/lib/api";
import { AuctionWithLead, BidWithUserName } from "@/lib/custom-types";

import { createClient } from "@/utils/supabase/client";

interface AuctionModalProps {
  auction: AuctionWithLead;
  userCredits: number;
  onClose: () => void;
}

export const AuctionModal = ({
  auction,
  userCredits,
  onClose,
}: AuctionModalProps) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [bidAmount, setBidAmount] = useState("");
  const [hasWon, setHasWon] = useState(false);

  const { data: bids = [], isLoading: isLoadingBids } = useQuery<
    BidWithUserName[]
  >({
    queryKey: ["bids", auction.id],
    queryFn: () => fetchBidsForAuction(auction.id),
    initialData: auction.bids,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`bids-auction-${auction.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `auction_id=eq.${auction.id}`,
        },
        (payload) => {
          console.log("[Realtime] Novo lance recebido:", payload.new);
          toast.info("Novo lance recebido!");
          queryClient.invalidateQueries({ queryKey: ["bids", auction.id] });
          queryClient.invalidateQueries({ queryKey: ["activeAuctions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction.id, supabase, queryClient]);

  const formatCurrency = (
    value: number | { toNumber(): number } | undefined
  ) => {
    if (value === undefined) return "N/A";
    const numericValue = typeof value === "number" ? value : value.toNumber();
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numericValue);
  };

  const highestBidAmount = bids.length > 0 ? bids[0].amount.toNumber() : 0;
  const currentBid = Math.max(
    highestBidAmount,
    auction.minimumBid ? auction.minimumBid.toNumber() : 0
  );

  const { mutate: placeBid, isPending: isSubmitting } = useMutation({
    mutationFn: (amount: number) => postBid({ auctionId: auction.id, amount }),
    onSuccess: () => {
      toast.success("Lance realizado com sucesso!");
      setBidAmount("");
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao dar o lance", { description: error.message });
    },
  });

  const handleExpire = () => {
    const lastBid = bids[0];
    if (lastBid && session?.user?.id && lastBid.userId === session.user.id) {
      setHasWon(true);
      toast.success("Parabéns! Você ganhou o leilão!");
    } else {
      toast("Leilão Encerrado!");
    }
  };

  const handleBid = () => {
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= currentBid) {
      toast.error("Lance inválido", {
        description: `Seu lance deve ser maior que ${formatCurrency(
          currentBid
        )}`,
      });
      return;
    }
    if (amount > userCredits) {
      toast.error("Créditos insuficientes", {
        description: `Você precisa de ${formatCurrency(amount)} em créditos.`,
      });
      return;
    }
    placeBid(amount);
  };

  const leadData = auction.leads;
  const isAuctionActive = new Date(auction.expiredAt).getTime() > Date.now();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-yellow-600">
              {leadData.companyName}
            </DialogTitle>
            <CountdownTimer
              expiresAt={auction.expiredAt.toISOString()}
              onExpire={handleExpire}
            />
          </div>
          <DialogDescription className="text-muted-foreground"></DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                {hasWon ? "Informações Completas do Lead" : "Prévia do Lead"}
              </h3>
              {hasWon && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-semibold">
                    <Badge className="bg-yellow-600 text-black">
                      ACESSO LIBERADO
                    </Badge>
                    Você ganhou este leilão!
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-yellow-600" />{" "}
                    <span className="text-sm text-muted-foreground">
                      Faturamento
                    </span>
                  </div>
                  <div className="font-bold text-lg text-yellow-700 dark:text-yellow-400">
                    {formatCurrency(leadData.revenue)}
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Megaphone className="h-4 w-4 text-foreground" />{" "}
                    <span className="text-sm text-muted-foreground">
                      Investimento Marketing
                    </span>
                  </div>
                  <div className="font-bold text-lg text-foreground">
                    {formatCurrency(leadData.marketingInvestment)}
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Building className="h-4 w-4 text-yellow-600" />{" "}
                    <span className="text-sm text-muted-foreground">
                      Nome da Empresa
                    </span>
                  </div>
                  <div className="font-bold text-yellow-700 dark:text-yellow-400">
                    {leadData.companyName}
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-foreground" />{" "}
                    <span className="text-sm text-muted-foreground">Nicho</span>
                  </div>
                  <div className="font-bold text-foreground">
                    {leadData.segment}
                  </div>
                </div>
              </div>
              <div
                className={`p-4 rounded-lg ${
                  hasWon
                    ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700"
                    : "bg-muted"
                }`}
              >
                <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-3">
                  Informações de Contato
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-yellow-600" />{" "}
                    <span className="font-medium">{leadData.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-yellow-600" />{" "}
                    <span
                      className={
                        hasWon
                          ? "text-yellow-700 dark:text-yellow-400"
                          : "text-muted-foreground"
                      }
                    >
                      {hasWon ? leadData.phone : "******"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-yellow-600" />{" "}
                    <span
                      className={
                        hasWon
                          ? "text-yellow-700 dark:text-yellow-400"
                          : "text-muted-foreground"
                      }
                    >
                      {hasWon ? leadData.email : "******"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isAuctionActive && !hasWon ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Fazer Lance</h3>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <Coins className="h-4 w-4" /> Seus créditos:{" "}
                    {userCredits.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-600">
                    <AlertCircle className="h-4 w-4" /> Lance mínimo:{" "}
                    {formatCurrency(
                      Math.max(currentBid + 1, auction.minimumBid.toNumber())
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Valor do lance"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="flex-1"
                      min={Math.max(
                        currentBid + 1,
                        auction.minimumBid.toNumber()
                      )}
                    />
                    <Button
                      onClick={handleBid}
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {isSubmitting ? "Enviando..." : "Dar Lance"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-muted rounded-lg text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {hasWon ? "Leilão Ganho!" : "Leilão Encerrado"}
                </h3>
                <p className="text-muted-foreground">
                  {hasWon
                    ? "Parabéns! Você ganhou este leilão."
                    : "Este leilão foi finalizado."}
                </p>
              </div>
            )}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Histórico de Lances</h3>
              {isLoadingBids ? (
                <p>Carregando histórico...</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {bids.map((bid, index) => (
                    <div
                      key={bid.id}
                      className={`p-3 rounded-lg border ${
                        index === 0
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700"
                          : "bg-muted border-border"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {bid.user?.name || "Participante"}
                          </span>
                          {index === 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-yellow-100 text-yellow-800 text-xs"
                            >
                              Maior lance
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-yellow-600">
                            {formatCurrency(bid.amount)}
                          </div>
                          {bid.createdAt && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(bid.createdAt).toLocaleTimeString(
                                "pt-BR"
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
