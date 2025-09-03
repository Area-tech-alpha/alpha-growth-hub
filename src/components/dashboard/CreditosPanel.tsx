"use client";

import { useState, useEffect } from "react";
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
  const [credits, setCredits] = useState<number>(currentCredits);

  useEffect(() => {
    console.log("abobora", session);
    const loadBalance = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch('/api/me/credits', { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.creditBalance === 'number') {
          setCredits(data.creditBalance);
        }
      } catch {
      }
    };
    loadBalance();
  }, [session?.user?.id]);



  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
      <PurchaseCreditsCard currentCredits={credits} defaultAmount={defaultAmount} />
      {userId && <PurchaseHistoryPanel userId={userId} />}
    </div>
  );
}
