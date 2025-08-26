"use client";

import React from "react";
import { buttonVariants } from "@/components/ui/button";
import CreditosPanel from "@/components/dashboard/CreditosPanel";
import LeiloesPanel from "@/components/dashboard/LeiloesPanel";
import MeusLeadsPanel from "@/components/dashboard/MeusLeadsPanel";
import { CiCreditCard1 } from "react-icons/ci";
import { IoMdTrendingUp } from "react-icons/io";
import { FiShoppingBag } from "react-icons/fi";

type TabKey = "creditos" | "leiloes" | "meus-leads";

export default function Home() {
  const [activeTab, setActiveTab] = React.useState<TabKey>("creditos");

  const tabButtonClass = (isActive: boolean) =>
    buttonVariants({
      variant: "outline",
      size: "sm",
      className: `rounded-full px-4 ${isActive
        ? "bg-yellow-200 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200 border-yellow-400 dark:border-yellow-700 shadow-sm"
        : ""
        }`,
    });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div
        role="tablist"
        aria-label="Dashboard tabs"
        className="flex items-center gap-2 border-b border-border/50 pb-3 sticky top-16 bg-background/80 backdrop-blur-sm z-40"
      >
        <button
          role="tab"
          aria-selected={activeTab === "creditos"}
          className={tabButtonClass(activeTab === "creditos")}
          onClick={() => setActiveTab("creditos")}
        >
          <CiCreditCard1 className="size-4" />
          Créditos
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "leiloes"}
          className={tabButtonClass(activeTab === "leiloes")}
          onClick={() => setActiveTab("leiloes")}
        >
          <IoMdTrendingUp className="size-4" />
          Leilões
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "meus-leads"}
          className={tabButtonClass(activeTab === "meus-leads")}
          onClick={() => setActiveTab("meus-leads")}
        >
          <FiShoppingBag className="size-4" />
          Meus Leads
        </button>
      </div>

      <section className="mt-6">
        {activeTab === "creditos" && (
          <div role="tabpanel" aria-labelledby="tab-creditos" className="grid gap-4">
            <CreditosPanel />
          </div>
        )}

        {activeTab === "leiloes" && (
          <div role="tabpanel" aria-labelledby="tab-leiloes" className="grid gap-4">
            <LeiloesPanel />
          </div>
        )}

        {activeTab === "meus-leads" && (
          <div role="tabpanel" aria-labelledby="tab-meus-leads" className="grid gap-4">
            <MeusLeadsPanel />
          </div>
        )}
      </section>
    </div>
  );
}
