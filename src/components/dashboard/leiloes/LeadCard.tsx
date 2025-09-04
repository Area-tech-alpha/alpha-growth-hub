"use client";

import {
  Eye,
  Building,
  User,
  Phone,
  Megaphone,
  DollarSign,
  Flame,
  Hash,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "../leads/CountdownTimer";
import { Lead } from "../leads/types";
import { maskPhone } from "@/lib/mask";
import { useEffect } from "react";

interface LeadCardProps {
  lead: Lead;
  onSelect?: () => void;
  onExpire: () => void;
}

export const LeadCard = ({ lead, onSelect, onExpire }: LeadCardProps) => {
  const formatCurrency = (value: number | undefined | null) => {
    const numericValue = typeof value === "number" && !isNaN(value) ? value : 0;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericValue);
  };

  useEffect(() => {
    console.log("[LeadCard] lead:", lead);
  }, [lead])

  const formatNumber = (value: number | undefined | null) => {
    return typeof value === "number" && !isNaN(value) ? value.toString() : "0";
  };

  const isHot = lead.status === "hot";

  return (
    <>
      <style jsx>{`
        @keyframes hot-glow {
          0%,
          100% {
            box-shadow: 0 0 4px rgba(245, 158, 11, 0.7),
              0 0 8px rgba(239, 68, 68, 0.6), 0 0 12px rgba(245, 158, 11, 0.5);
          }
          50% {
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.8),
              0 0 16px rgba(245, 158, 11, 0.7), 0 0 20px rgba(239, 68, 68, 0.6);
          }
        }
        .hot-lead-card {
          animation: hot-glow 2.5s ease-in-out infinite;
          border-color: transparent;
        }
      `}</style>

      <Card
        className={`flex flex-col h-full relative overflow-hidden transition-all duration-300 bg-card text-card-foreground ${isHot
          ? "hot-lead-card hover:shadow-lg hover:shadow-red-500/40"
          : "border border-border hover:border-yellow-300"
          }`}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 flex items-center gap-3">
              {isHot && (
                <div className="flex items-center gap-1.5 bg-red-600 text-white pl-2 pr-3 py-1 rounded-full text-sm font-bold shadow-lg z-10 flex-shrink-0">
                  <Flame size={16} />
                  <span>HOT</span>
                </div>
              )}
              <CardTitle className="text-lg font-bold text-yellow-600">
                {lead.company_name}
              </CardTitle>
            </div>
            <div className="flex-shrink-0">
              <CountdownTimer
                expiresAt={lead.expires_at}
                onExpire={onExpire}
                isHot={isHot}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col space-y-4">
          <div className="space-y-3 p-3 bg-muted rounded-lg">
            <h4 className="font-semibold text-foreground text-sm mb-2">
              Informações do Lead (Prévia)
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
                <Megaphone className="h-3 w-3 text-yellow-600 " />
                <div>
                  <div className="text-muted-foreground">Invest. Marketing</div>
                  <div className="font-semibold">
                    {formatCurrency(lead.marketing_investment)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-3 w-3 text-yellow-600" />
                <div>
                  <div className="text-muted-foreground">Empresa</div>
                  <div className="font-semibold">
                    {lead.company_name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-yellow-600" />
                <div>
                  <div className="text-muted-foreground">Contato</div>
                  <div className="font-semibold">
                    {lead.contact_name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-yellow-600" />
                <div>
                  <div className="text-muted-foreground">Telefone</div>
                  <div className="font-semibold">
                    {maskPhone(lead.phone)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-3 w-3 text-yellow-600" />
                <div>
                  <div className="text-muted-foreground">CNPJ</div>
                  <div className="font-semibold">
                    {(lead as unknown as { cnpj?: string })?.cnpj || "N/A"}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">
                {formatCurrency(lead.currentBid)}
              </div>
              <div className="text-xs text-muted-foreground">Lance Atual</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">
                {formatNumber(lead.bidders)}
              </div>
              <div className="text-xs text-muted-foreground">Lances</div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="mt-auto pt-4">
          <Button
            onClick={onSelect}
            className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Leilão
          </Button>
        </CardFooter>
      </Card>
    </>
  );
};
