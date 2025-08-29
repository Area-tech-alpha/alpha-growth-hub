"use client";

import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import LeiloesPanel from "@/components/dashboard/LeiloesPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag } from "react-icons/fi";
import type { Auction } from "@/lib/types";

export default function Dashboard({
  initialAuctions,
}: {
  initialAuctions: Auction[];
}) {
  const searchParams = useSearchParams();

  const {
    data: user,
    isLoading: isLoadingUser,
    isError,
  } = useQuery({
    queryKey: ["userProfile"],
    queryFn: fetchUserProfile,
  });

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      if (status === "cancelled") {
        toast.warning("Compra cancelada", {
          description: "Você interrompeu o processo de pagamento.",
        });
      } else if (status === "expired") {
        toast.error("Pagamento expirado", {
          description: "O link de pagamento expirou.",
        });
      }
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  if (isLoadingUser) {
    return (
      <div className="container mx-auto p-8 space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="border rounded-lg p-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-10 text-red-500">
        Erro ao carregar seus dados. Por favor, tente recarregar a página.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Tabs defaultValue="leiloes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leiloes">
            <IoMdTrendingUp className="mr-2" />
            Leilões
          </TabsTrigger>
          <TabsTrigger value="meus-leads">
            <FiShoppingBag className="mr-2" />
            Meus Leads
          </TabsTrigger>
          <TabsTrigger value="creditos">
            <CiCreditCard1 className="mr-2" />
            Créditos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leiloes" className="mt-4">
          <LeiloesPanel
            userCredits={user?.creditBalance || 0}
            initialAuctions={initialAuctions}
          />
        </TabsContent>
        <TabsContent value="meus-leads" className="mt-4">
          <MeusLeadsPanel />
        </TabsContent>
        <TabsContent value="creditos" className="mt-4">
          <CreditosPanel currentCredits={user?.creditBalance || 0} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
