"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";

const AdminOverview = dynamic(() => import("@/components/admin/AdminOverview"), { ssr: false });
const AdminFinance = dynamic(() => import("@/components/admin/AdminFinance"), { ssr: false });
const AdminCredits = dynamic(() => import("@/components/admin/AdminCredits"), { ssr: false });
const AdminBlackNovember = dynamic(() => import("@/components/admin/AdminBlackNovember"), { ssr: false });

export default function AdminDashboardTabs() {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Visão geral</TabsTrigger>
        <TabsTrigger value="finance">Financeiro</TabsTrigger>
        <TabsTrigger value="credits">Créditos</TabsTrigger>
        <TabsTrigger value="black-november">Black November</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4">
        <AdminOverview />
      </TabsContent>
      <TabsContent value="finance" className="mt-4">
        <AdminFinance />
      </TabsContent>
      <TabsContent value="credits" className="mt-4">
        <AdminCredits />
      </TabsContent>
      <TabsContent value="black-november" className="mt-4">
        <AdminBlackNovember />
      </TabsContent>
    </Tabs>
  );
}

