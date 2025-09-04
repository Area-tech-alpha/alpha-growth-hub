"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import PurchaseHistoryPanel from "../credito/PurchaseHistoryPanel";
import PurchaseCreditsCard from "../credito/PurchaseCreditsCard";
import { LuHistory } from "react-icons/lu";

type CreditosPanelContainerProps = {
  currentCredits?: number;
  defaultAmount?: number;
};

export default function CreditosPanel({
  currentCredits = 0,
  defaultAmount = 150,
}: CreditosPanelContainerProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [cardHeight, setCardHeight] = useState<number | undefined>(undefined);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
      <div className="lg:col-span-1">
        <PurchaseCreditsCard
          currentCredits={currentCredits}
          defaultAmount={defaultAmount}
          onHeightReady={setCardHeight}
        />
      </div>
      <div className="lg:col-span-2">
        {userId ? (
          <PurchaseHistoryPanel targetHeight={cardHeight} />
        ) : (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg p-6 bg-card">
            <LuHistory className="h-10 w-10 mb-3 text-muted-foreground/60" />
            <p className="text-lg font-medium">
              Faça login para ver seu histórico de compras.
            </p>
            <p className="text-sm">
              Seu histórico de transações aparecerá aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
