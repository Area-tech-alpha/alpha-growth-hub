"use client";

import React from "react";
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      <div className="w-full md:w-2/5 lg:w-1/3 flex-shrink-0">
        <PurchaseCreditsCard
          currentCredits={currentCredits}
          defaultAmount={defaultAmount}
        />
      </div>

      <div className="w-full md:w-3/5 lg:w-2/3 flex-grow">
        {userId ? (
          <PurchaseHistoryPanel />
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
