"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Auction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Eye,
  DollarSign,
  Megaphone,
  Building,
  Target,
  User,
  Phone,
  Mail,
} from "lucide-react";
import { CountdownTimer } from "../leads/CountdownTimer";

interface LeadCardProps {
  auction: Auction;
  onSelect: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

export function LeadCard({ auction, onSelect }: LeadCardProps) {
  const { lead } = auction;

  return (
    <Card
      className={`hover:shadow-lg transition-all duration-200 border bg-card text-card-foreground hover:border-yellow-300 ${
        lead.status === "hot" ? "border-red-500" : "border-border"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-yellow-600 mb-2">
              {lead.name}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4" />
              {lead.location}
            </div>
          </div>
          <CountdownTimer expiresAt={auction.expiredAt} onExpire={() => {}} />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{lead.channel}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 p-3 bg-muted rounded-lg">
          <h4 className="font-semibold text-foreground text-sm mb-2">
            Informações do Lead
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <DollarSign className="h-3 w-3 text-yellow-600" />
              <div>
                <div className="text-muted-foreground">Faturamento</div>
                <div className="font-semibold">
                  {formatCurrency(lead.revenue)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-3 w-3 text-foreground" />
              <div>
                <div className="text-muted-foreground">Invest. Marketing</div>
                <div className="font-semibold">
                  {formatCurrency(lead.marketingInvestment)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-3 w-3 text-yellow-600" />
              <div>
                <div className="text-muted-foreground">Empresa</div>
                <div className="font-semibold text-muted-foreground">
                  {lead.companyName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-foreground" />
              <div>
                <div className="text-muted-foreground">Nicho</div>
                <div className="font-semibold">{lead.segment}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">
              {formatCurrency(auction.currentBid)}
            </div>
            <div className="text-xs text-muted-foreground">Lance Atual</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              {auction.bidders || 0}
            </div>
            <div className="text-xs text-muted-foreground">Lances</div>
          </div>
        </div>
        <Button
          onClick={onSelect}
          className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black"
        >
          <Eye className="h-4 w-4 mr-2" />
          Ver Leilão
        </Button>
      </CardContent>
    </Card>
  );
}
