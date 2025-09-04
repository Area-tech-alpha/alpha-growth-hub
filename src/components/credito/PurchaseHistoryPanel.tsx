"use client";

import React, { useEffect, useState } from "react";
import { useRealtimeStore } from "@/store/realtime-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LuHistory } from "react-icons/lu";
import { CheckCircle } from "lucide-react";

type Purchase = {
  id: string | number;
  created_at: string;
  amount_credits?: number;
  credits_purchased?: number;
  amount_paid?: number;
  status?: "completed" | "pending" | "failed";
};

export default function PurchaseHistoryPanel() {
  const [loading, setLoading] = useState(true);
  const purchases = useRealtimeStore((s) => s.userPurchases) as Purchase[];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (Array.isArray(purchases)) {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [purchases]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
            <LuHistory className="h-6 w-6 text-yellow-400 dark:text-yellow-300" />
          </div>
          <div>
            <CardTitle className="text-xl">Histórico de Compras</CardTitle>
            <CardDescription>
              Suas últimas transações de créditos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow min-h-0 overflow-y-auto pr-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma compra realizada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="flex items-center justify-between text-sm p-3 rounded-lg bg-yellow-900/30 hover:bg-yellow-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {(
                        purchase.amount_credits ??
                        purchase.credits_purchased ??
                        0
                      ).toLocaleString("pt-BR")}{" "}
                      créditos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(purchase.created_at)}
                    </p>
                  </div>
                </div>
                <div className="font-medium text-right pl-2">
                  R$ {(purchase.amount_paid ?? 0).toLocaleString("pt-BR")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
