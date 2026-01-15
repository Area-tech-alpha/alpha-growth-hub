"use client";

import { useState, type ReactNode } from "react";
import {
  Phone,
  Mail,
  Building,
  DollarSign,
  Megaphone,
  Clock,
  Download,
  User,
  Instagram,
  // MapPin,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lead } from "./types";
import { ToastBus } from "@/lib/toastBus";

interface PurchasedLeadCardProps {
  lead: Lead;
  purchaseDate: Date;
  purchasePrice?: number;
}

export const PurchasedLeadCard = ({
  lead,
  purchaseDate,
  purchasePrice,
}: PurchasedLeadCardProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const formatCurrency = (value: number | undefined | null) => {
    const numericValue = typeof value === "number" && !isNaN(value) ? value : 0;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericValue);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const rawInstagram = (lead as unknown as { instagram?: string })?.instagram;
  const instagramHandle = rawInstagram?.trim().replace(/^@+/, "");
  const instagramLabel = instagramHandle ? `@${instagramHandle}` : undefined;
  const instagramUrl = instagramHandle
    ? `https://instagram.com/${instagramHandle}`
    : undefined;

  const handleExport = async () => {
    setIsExporting(true);
    ToastBus.csvPreparing();

    try {
      const response = await fetch(`/api/leads/${lead.id}/export`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao gerar o arquivo.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      const disposition = response.headers.get("content-disposition");
      let filename = `lead_${lead.company_name?.replace(/\s+/g, "_")}.csv`;
      if (disposition?.includes("filename=")) {
        filename = disposition.split("filename=")[1].replace(/"/g, "");
      }
      a.download = filename;

      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);

      ToastBus.csvDownloadStarted();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o arquivo CSV.";
      ToastBus.csvError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };
  const InfoRow = ({
    icon: Icon,
    label,
    value,
    valueClassName,
  }: {
    icon: React.ElementType;
    label: string;
    value: ReactNode;
    valueClassName?: string;
  }) => (
    <div className="flex items-center gap-3 p-2 bg-background/50 rounded-md border border-border">
      <Icon className="h-4 w-4 text-yellow-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div
          className={`font-semibold text-foreground break-words ${valueClassName}`}
        >
          {value}
        </div>
      </div>
    </div>
  );

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-all duration-200 border border-border bg-card text-card-foreground">
      <CardHeader className="border-b border-border p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-yellow-600 flex items-center gap-2">
              <Building className="h-5 w-5" />
              {lead.company_name || "Nome da Empresa"}
            </CardTitle>
            {/*
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {lead.city && lead.state
                  ? `${lead.city} - ${lead.state}`
                  : (lead.city || lead.state || "N/A")}
              </span>
            </div>
            */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(purchaseDate)}</span>
            </div>
          </div>
          <div className="flex-shrink-0 text-left sm:text-right">
            <div className="text-sm text-muted-foreground">Comprado por</div>
            <div className="text-lg font-bold text-yellow-600 min-h-[1.75rem] flex items-center">
              {purchasePrice !== undefined ? (
                <>{formatCurrency(purchasePrice)}</>
              ) : (
                <Skeleton className="h-5 w-24 rounded" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-4 space-y-4">
        <div>
          <h4 className="font-semibold text-foreground text-sm mb-2">
            Dados da Empresa
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoRow
              icon={DollarSign}
              label="Faturamento"
              value={String(lead.revenue)}
            />
            <InfoRow
              icon={Megaphone}
              label="Invest. Marketing"
              value={String(lead.marketing_investment)}
            />
            {typeof lead.contract_value === "number" && !isNaN(lead.contract_value) && (
              <InfoRow
                icon={DollarSign}
                label="Valor do Contrato"
                value={formatCurrency(lead.contract_value)}
              />
            )}
            {lead.contract_time && (
              <InfoRow
                icon={Clock}
                label="Tempo de Contrato"
                value={String(lead.contract_time)}
              />
            )}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-foreground text-sm mb-2">
            Dados de Contato
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <InfoRow
              icon={User}
              label="Nome"
              value={lead.contact_name || "N/A"}
            />
            <InfoRow
              icon={Phone}
              label="Telefone"
              value={lead.phone || "N/A"}
              valueClassName="tracking-wider"
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={lead.email || "N/A"}
              valueClassName="[overflow-wrap:anywhere]"
            />
            {instagramHandle && instagramUrl && (
              <InfoRow
                icon={Instagram}
                label="Instagram"
                value={
                  <div className="flex flex-col">
                    <span>{instagramLabel}</span>
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-foreground hover:underline"
                    >
                      Visitar
                    </a>
                  </div>
                }
              />
            )}
          </div>
        </div>

        {(lead.briefing_url || lead.contract_url || lead.document_url || lead.cal_url) && (
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-2">
              Links
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lead.briefing_url && (
                <Button asChild variant="outline" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full">
                  <a href={lead.briefing_url} target="_blank" rel="noopener noreferrer">
                    Abrir briefing
                  </a>
                </Button>
              )}
              {lead.contract_url && (
                <Button asChild variant="outline" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full">
                  <a href={lead.contract_url} target="_blank" rel="noopener noreferrer">
                    Abrir contrato
                  </a>
                </Button>
              )}
              {lead.document_url && (
                <Button asChild variant="outline" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full sm:col-span-2">
                  <a href={lead.document_url} target="_blank" rel="noopener noreferrer">
                    Abrir documento
                  </a>
                </Button>
              )}
              {lead.cal_url && (
                <Button asChild variant="default" size="sm" className="h-9 sm:h-7 px-3 sm:px-2.5 w-full sm:col-span-2 bg-green-600 hover:bg-green-700 text-white">
                  <a href={lead.cal_url} target="_blank" rel="noopener noreferrer">
                    Ver gravação
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-border pt-4">
        <Button
          onClick={handleExport}
          disabled={isExporting}
          variant="outline"
          className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black shadow-md transition-all duration-200"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </CardFooter>
    </Card>
  );
};
