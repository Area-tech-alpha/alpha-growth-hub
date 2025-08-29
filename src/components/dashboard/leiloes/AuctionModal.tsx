"use client";

import { useState } from "react";
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
import { Decimal } from "@prisma/client/runtime/library";

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

  const [isAuctionActive, setIsAuctionActive] = useState(
    new Date(auction.expiredAt).getTime() > Date.now()
  );
  const [bidAmount, setBidAmount] = useState("");
  const [hasWon, setHasWon] = useState(false);

  const formatCurrency = (value: number | Decimal | undefined) => {
    if (value === undefined) return "N/A";
    const numericValue = typeof value === "number" ? value : value.toNumber();
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numericValue);
  };

  const { data: bids = [], isLoading: isLoadingBids } = useQuery<
    BidWithUserName[]
  >({
    queryKey: ["bids", auction.id],
    queryFn: () => fetchBidsForAuction(auction.id),
  });

  const highestBidAmount = bids.length > 0 ? bids[0].amount.toNumber() : 0;
  const currentBid = Math.max(highestBidAmount, auction.minimumBid.toNumber());

  const { mutate: placeBid, isPending: isSubmitting } = useMutation({
    mutationFn: (amount: number) => postBid({ auctionId: auction.id, amount }),
    onSuccess: () => {
      toast.success("Lance realizado com sucesso!");
      setBidAmount("");
      queryClient.invalidateQueries({ queryKey: ["bids", auction.id] });
      queryClient.invalidateQueries({ queryKey: ["activeAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao dar o lance", { description: error.message });
    },
  });

  const handleExpire = () => {
    setIsAuctionActive(false);
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
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                {hasWon ? "Informações Completas do Lead" : "Prévia do Lead"}
              </h3>

              <div className="font-bold text-lg text-yellow-700 dark:text-yellow-400">
                {formatCurrency(leadData.revenue)}
              </div>
              {/* ... (aplicar .toNumber() para outros campos decimais como marketingInvestment) */}
            </div>
          </div>

          <div className="space-y-6">
            {/* ... (o resto do seu JSX para o formulário de lance permanece igual) ... */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bids.map((bid, index) => (
                <div key={bid.id} /* ... */>
                  {/* ... */}
                  <span className="font-medium">
                    {bid.user.name || "Usuário"}
                  </span>
                  {/* ... */}
                  <div className="font-bold text-yellow-600">
                    {formatCurrency(bid.amount)}
                  </div>
                  {/* ... */}
                </div>
              ))}
            </div>
            {/* ... */}
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
