"use client";

import { } from "react";
import { useSession } from "next-auth/react";
import PurchaseHistoryPanel from "../credito/PurchaseHistoryPanel";
import PurchaseCreditsCard from "../credito/PurchaseCreditsCard";

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
      <PurchaseCreditsCard currentCredits={currentCredits} defaultAmount={defaultAmount} />
      {userId && <PurchaseHistoryPanel userId={userId} />}
    </div>
  );
}
