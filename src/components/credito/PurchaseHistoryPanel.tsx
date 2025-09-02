"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
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
  id: string;
  created_at: string;
  amount_credits: number;
  amount_paid: number;
  status: "completed" | "pending" | "failed";
};

export default function PurchaseHistoryPanel({ userId }: { userId: string }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("credit_purchases")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Erro ao buscar histórico de compras:", error);
        setError("Não foi possível carregar o histórico.");
      } else {
        setPurchases(data as Purchase[]);
      }
      setLoading(false);
    };

    fetchPurchases();

    const channel = supabase
      .channel(`credit_purchases_user_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_purchases",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setPurchases((currentPurchases) => [
            payload.new as Purchase,
            ...currentPurchases,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Card>
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
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm text-center">{error}</p>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma compra realizada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-semibold">
                      {purchase.amount_credits.toLocaleString("pt-BR")} créditos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(purchase.created_at)}
                    </p>
                  </div>
                </div>
                <div className="font-medium">
                  R$ {purchase.amount_paid.toLocaleString("pt-BR")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
