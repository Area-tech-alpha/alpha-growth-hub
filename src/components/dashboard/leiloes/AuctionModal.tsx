"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import type { AuctionWithLead, BidWithUserName } from "@/lib/custom-types";
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
  const supabase = createClient();
  const leadData = auction.leads;

  const [isAuctionActive, setIsAuctionActive] = useState(
    new Date(auction.expiredAt).getTime() > Date.now()
  );
  const [bids, setBids] = useState<BidWithUserName[]>(auction.bids || []);
  const [bidAmount, setBidAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasWon, setHasWon] = useState(false);

  const highestBidAmount = bids.length > 0 ? Number(bids[0].amount) : 0;
  const minimumBid = Number(auction.minimumBid) || 0;
  const currentBid = Math.max(highestBidAmount, minimumBid);

  const handleExpire = () => {
    setIsAuctionActive(false);
    const lastBid = bids[0];
    if (lastBid && lastBid.userId === session?.user?.id) {
      setHasWon(true);
    }
  };

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
          if (!payload.new) return;
          const newBidWithUser = {
            ...payload.new,
            user: { name: "Novo Participante" },
          } as BidWithUserName;
          setBids((prevBids) => {
            if (prevBids.some((b) => b.id === newBidWithUser.id))
              return prevBids;
            const sortedBids = [...prevBids, newBidWithUser].sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });
            return sortedBids;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction.id, supabase]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleBid = async () => {
    const amount = parseFloat(bidAmount);

    if (!isAuctionActive) {
      toast.error("Leilão encerrado", {
        description: "Não é possível enviar lances após o término.",
      });
      return;
    }
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
        description: `Você não tem créditos suficientes para este lance.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("bids").insert({
        auction_id: auction.id,
        user_id: session?.user?.id,
        amount: amount,
      });

      if (error) throw error;

      toast.success("Lance realizado com sucesso!");
      setBidAmount("");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Falha ao enviar lance", { description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
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
              <InfoCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Faturamento"
                value={formatCurrency(Number(leadData.revenue))}
                highlight
              />
              <InfoCard
                icon={<Megaphone className="h-4 w-4" />}
                label="Investimento Marketing"
                value={formatCurrency(Number(leadData.marketingInvestment))}
              />
              <InfoCard
                icon={<Building className="h-4 w-4" />}
                label="Nome da Empresa"
                value={leadData.companyName ?? ""}
                highlight
              />
              <InfoCard
                icon={<Target className="h-4 w-4" />}
                label="Nicho"
                value={leadData.segment ?? ""}
              />
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
                <ContactInfo
                  icon={<User className="h-4 w-4" />}
                  value={leadData.contactName ?? ""}
                />
                <ContactInfo
                  icon={<Phone className="h-4 w-4" />}
                  value={hasWon ? leadData.phone ?? "" : "******"}
                  isRevealed={hasWon}
                />
                <ContactInfo
                  icon={<Mail className="h-4 w-4" />}
                  value={hasWon ? leadData.email ?? "" : "******"}
                  isRevealed={hasWon}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isAuctionActive && !hasWon ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Fazer Lance</h3>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Coins className="h-4 w-4" />
                    Seus créditos: {userCredits.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    Lance mínimo: {formatCurrency(currentBid + 1)}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Valor do lance"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="flex-1"
                      min={currentBid + 1}
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
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {bids.length > 0 ? (
                  bids.map((bid, index) => (
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
                            {formatCurrency(Number(bid.amount))}
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

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const InfoCard = ({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div
    className={`p-3 rounded-lg ${
      highlight
        ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700"
        : "bg-muted"
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <div className={highlight ? "text-yellow-600" : "text-foreground"}>
        {icon}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <div
      className={`font-bold text-lg ${
        highlight ? "text-yellow-700 dark:text-yellow-400" : "text-foreground"
      }`}
    >
      {value}
    </div>
  </div>
);

const ContactInfo = ({
  icon,
  value,
  isRevealed = false,
}: {
  icon: React.ReactElement;
  value: string;
  isRevealed?: boolean;
}) => (
  <div className="flex items-center gap-2">
    <div className="text-yellow-600">{icon}</div>
    <span
      className={
        isRevealed
          ? "text-yellow-700 dark:text-yellow-400"
          : "text-muted-foreground"
      }
    >
      {value}
    </span>
  </div>
);
