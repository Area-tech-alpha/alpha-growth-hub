"use client";

import React from "react";
import Header from "@/components/Header";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showHeader = !(pathname?.startsWith("/login"));

    return (
        <div className="flex flex-col min-h-screen">
            {showHeader && <Header />}
            <main className={showHeader ? "flex-1 pt-18" : "flex-1"}>
                {children}
            </main>
        </div>
    );
}


