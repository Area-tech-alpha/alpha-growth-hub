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
  MapPin,
  Clock,
  Layers,
  ListOrdered,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "../leads/CountdownTimer";
import { Lead } from "../leads/types";
import type { BatchAuctionSummary } from "../leiloes/types";
import { maskName, maskPhone } from "@/lib/mask";

interface LeadCardProps {
  lead: Lead;
  auctionType?: "single" | "batch";
  batchSummary?: BatchAuctionSummary;
  onSelect?: () => void;
  onExpire: () => void;
}

export const LeadCard = ({ lead, auctionType = "single", batchSummary, onSelect, onExpire }: LeadCardProps) => {
  const formatCurrency = (value: number | undefined | null) => {
    const numericValue = typeof value === "number" && !isNaN(value) ? value : 0;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericValue);
  };

  const formatNumber = (value: number | undefined | null) => {
    return typeof value === "number" && !isNaN(value) ? value.toString() : "0";
  };

  const isHot = lead.status === "hot";
  const documentUrl = (lead as unknown as { document_url?: string })?.document_url;
  const contractUrl = (lead as unknown as { contract_url?: string })?.contract_url;
  const contractValue = (lead as unknown as { contract_value?: number })?.contract_value;
  const contractTime = (lead as unknown as { contract_time?: string })?.contract_time;
  const rawContractInstallments = (lead as unknown as { contract_installments?: number | string | null })?.contract_installments;
  const contractInstallments =
    typeof rawContractInstallments === "number"
      ? rawContractInstallments
      : rawContractInstallments != null && rawContractInstallments !== ""
        ? Number(rawContractInstallments)
        : null;
  const briefingUrl = (lead as unknown as { briefing_url?: string })?.briefing_url;
  const calUrl = lead.cal_url as string | undefined;

  const isBatchAuction = auctionType === "batch";
  const summary = batchSummary;
  const previewLeads = isBatchAuction && summary ? summary.leads.slice(0, 3) : [];


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
            <div className="flex-1 flex items-center gap-3 min-w-0 flex-wrap">
              {isHot && !isBatchAuction && (
                <div className="flex items-center gap-1.5 bg-red-600 text-white pl-2 pr-3 py-1 rounded-full text-sm font-bold shadow-lg z-10 flex-shrink-0">
                  <Flame size={16} />
                  <span>HOT</span>
                </div>
              )}
              {isBatchAuction && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs uppercase">
                  <Layers className="h-3 w-3" />
                  <span>Lote</span>
                </Badge>
              )}
              <CardTitle
                className="text-lg font-bold text-yellow-600 truncate flex-1"
                title={
                  isBatchAuction
                    ? summary
                      ? `Lote com ${summary.totalLeads} leads`
                      : "Lote aguardando composição"
                    : maskName(lead.company_name)
                }
              >
                {isBatchAuction
                  ? summary
                    ? `Lote com ${summary.totalLeads} leads`
                    : "Lote em preparação"
                  : lead.company_name}
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            <span>
              {lead.city && lead.state
                ? `${lead.city} - ${lead.state}`
                : (lead.city || lead.state || "N/A")}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col space-y-4">
          <div className="space-y-3 p-3 bg-muted rounded-lg">
            <h4 className="font-semibold text-foreground text-sm mb-2">
              {isBatchAuction ? "Informações do lote" : "Informações do Lead (Prévia)"}
            </h4>
            {isBatchAuction && !summary ? (
              <div className="text-xs text-muted-foreground">Carregando composição do lote...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {isBatchAuction && summary ? (
                    <>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3 text-yellow-600" />
                        <div>
                          <div className="text-muted-foreground">Preço por lead</div>
                          <div className="font-semibold">
                            {formatCurrency(summary.leadUnitPrice)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3 text-yellow-600" />
                        <div>
                          <div className="text-muted-foreground">Lance mínimo</div>
                          <div className="font-semibold">
                            {formatCurrency(summary.minimumBid)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Layers className="h-3 w-3 text-yellow-600" />
                        <div>
                          <div className="text-muted-foreground">Leads no lote</div>
                          <div className="font-semibold">
                            {summary.totalLeads}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3 text-yellow-600" />
                        <div>
                          <div className="text-muted-foreground">Faturamento</div>
                          <div className="font-semibold">
                            {String(lead.revenue)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-3 w-3 text-yellow-600 " />
                        <div>
                          <div className="text-muted-foreground">Invest. Marketing</div>
                          <div className="font-semibold">
                            {String(lead.marketing_investment)}
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
                            {maskName(lead.contact_name)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-yellow-600" />
                        <div>
                          <div className="text-muted-foreground">Telefone</div>
                          <div className="font-semibold" data-value="masked">
                            {maskPhone(lead.phone)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="h-3 w-3 text-yellow-600" />
                        <div>
                          <div className="text-muted-foreground">CNPJ</div>
                          <div className="font-semibold">
                            {(lead as unknown as { cnpj?: string })?.cnpj}
                          </div>
                        </div>
                      </div>
                      {typeof contractValue === "number" && !isNaN(contractValue) && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3 w-3 text-yellow-600" />
                          <div>
                            <div className="text-muted-foreground">Valor do Contrato</div>
                            <div className="font-semibold">
                              {formatCurrency(contractValue)}
                            </div>
                          </div>
                        </div>
                      )}
                      {contractTime && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-yellow-600" />
                          <div>
                            <div className="text-muted-foreground">Tempo de Contrato</div>
                            <div className="font-semibold">
                              {contractTime}
                            </div>
                          </div>
                        </div>
                      )}
                      {isHot && typeof contractInstallments === "number" && contractInstallments > 0 && (
                        <div className="flex items-center gap-2">
                          <ListOrdered className="h-3 w-3 text-yellow-600" />
                          <div>
                            <div className="text-muted-foreground">Parcelas do Contrato</div>
                            <div className="font-semibold">
                              {contractInstallments}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {isBatchAuction && summary && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-foreground">
                      Prévia do lote
                    </h5>
                    {previewLeads.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum lead disponível.</p>
                    ) : (
                      <ul className="space-y-1">
                        {previewLeads.map((item) => (
                          <li key={item.id} className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground truncate">{maskName(item.company_name)}</span>
                            <span>{item.city ? `${item.city} - ${item.state || ""}` : item.state || "—"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
            {!isBatchAuction && isHot && (documentUrl || contractUrl || calUrl || briefingUrl) && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {briefingUrl && (
                  <Button asChild variant="outline" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full">
                    <a href={briefingUrl} target="_blank" rel="noopener noreferrer">
                      Abrir briefing
                    </a>
                  </Button>
                )}
                {contractUrl && (
                  <Button asChild variant="outline" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full">
                    <a href={contractUrl} target="_blank" rel="noopener noreferrer">
                      Abrir contrato
                    </a>
                  </Button>
                )}
                {documentUrl && (
                  <Button asChild variant="outline" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full sm:col-span-2">
                    <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                      Abrir documento
                    </a>
                  </Button>
                )}
                {calUrl && (
                  <Button asChild variant="default" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full sm:col-span-2 bg-green-600 hover:bg-green-700 text-white">
                    <a href={calUrl} target="_blank" rel="noopener noreferrer">
                      Ver gravação
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">
                {formatCurrency(lead.currentBid ?? 0)}
              </div>
              <div className="text-xs text-muted-foreground">Lance Atual</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">
                {formatNumber(lead.bidders ?? 0)}
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

