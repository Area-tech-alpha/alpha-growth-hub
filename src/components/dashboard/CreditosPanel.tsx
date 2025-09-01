"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function CreditosPanel({
  currentCredits = 0,
}: {
  currentCredits: number;
}) {
  const { data: session } = useSession();
  const [amount, setAmount] = React.useState<number>(130);
  const [loading, setLoading] = React.useState(false);

  const handleBuy = async () => {
    if (!session?.user?.email || !session?.user?.name) {
      toast.error("Você precisa estar logado para comprar créditos.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          customerEmail: session.user.email,
          customerName: session.user.name,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Falha ao iniciar o checkout.");
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Ocorreu um erro desconhecido";
      toast.error("Falha ao iniciar pagamento", { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Comprar Créditos</CardTitle>
        <CardDescription>
          Saldo atual: {currentCredits.toLocaleString("pt-BR")} créditos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          min={130}
          placeholder="Mínimo de 130 créditos"
        />
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleBuy}
          disabled={loading || !session}
          className="w-full"
        >
          {loading
            ? "Processando..."
            : `Comprar ${amount.toLocaleString("pt-BR")} créditos`}
        </Button>
      </CardFooter>
    </Card>
  );
}
