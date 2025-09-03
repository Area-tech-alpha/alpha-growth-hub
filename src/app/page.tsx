import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth";
import type { Lead as AuctionLead } from "@/components/dashboard/leads/types";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const supabase = await createClient();

  type DbLead = {
    id: string;
    name?: string | null;
    description?: string | null;
    status?: string | null;
    expires_at?: string | null;
    expired_at?: string | null;
    location?: string | null;
    channel?: string | null;
    revenue?: unknown;
    marketing_investment?: unknown;
    company_name?: string | null;
    contact_name?: string | null;
    phone?: string | null;
    email?: string | null;
    masked_company_name?: string | null;
    segment?: string | null;
    niche?: string | null;
    masked_contact_name?: string | null;
    masked_phone?: string | null;
    masked_email?: string | null;
    current_bid?: unknown;
    currentBid?: unknown;
    owner_id?: string | null;
    bidders?: unknown;
    category?: string | null;
    tags?: unknown;
    updated_at?: string | Date | null;
  };

  const toLead = (row: DbLead): AuctionLead => {
    const statusRaw = String(row.status ?? "cold");
    const allowed = [
      "hot",
      "high_frozen",
      "low_frozen",
      "cold",
      "sold",
    ] as const;
    const status = (allowed as readonly string[]).includes(statusRaw)
      ? (statusRaw as AuctionLead["status"])
      : "cold";
    return {
      id: String(row.id),
      name: String(row.name ?? row.company_name ?? ""),
      description: String(row.description ?? ""),
      status,
      expires_at: String(
        row.expires_at ?? row.expired_at ?? new Date().toISOString()
      ),
      location: String(row.location ?? ""),
      channel: String(row.channel ?? ""),
      revenue: Number(row.revenue ?? 0),
      marketingInvestment: Number(row.marketing_investment ?? 0),
      companyName: String(row.company_name ?? ""),
      contactName: String(row.contact_name ?? ""),
      phone: String(row.phone ?? ""),
      email: String(row.email ?? ""),
      maskedCompanyName: String(
        row.masked_company_name ?? row.company_name ?? ""
      ),
      niche: String(row.segment ?? row.niche ?? ""),
      maskedContactName: String(
        row.masked_contact_name ?? row.contact_name ?? ""
      ),
      maskedPhone: String(row.masked_phone ?? row.phone ?? ""),
      maskedEmail: String(row.masked_email ?? row.email ?? ""),
      currentBid: Number(row.current_bid ?? row.currentBid ?? 0),
      owner_id: row.owner_id ? String(row.owner_id) : undefined,
      bidders: Number(row.bidders ?? 0),
      category: String(row.category ?? ""),
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      updated_at: row.updated_at
        ? new Date(row.updated_at as string).toISOString()
        : undefined,
    } as AuctionLead;
  };
  const { data: initialAuctions, error: auctionError } = await supabase
    .from("auctions")
    .select("*, leads(*)")
    .eq("status", "open")
    .gt("expired_at", new Date().toISOString());

  if (auctionError) {
    console.error("[Home] Erro ao buscar leilões:", auctionError.message);
  } else {
    console.log("[Home] initialAuctions count:", initialAuctions?.length ?? 0);
  }

  let purchasedLeads: AuctionLead[] = [];
  if (session?.user?.id) {
    try {
      const owned = await prisma.leads.findMany({
        where: { owner_id: session.user.id },
        orderBy: { updated_at: "desc" },
      });
      purchasedLeads = (owned || []).map(toLead);
      console.log(
        "[Home] purchasedLeads count (SSR via Prisma):",
        purchasedLeads.length
      );
    } catch (e) {
      console.error("[Home] Prisma leads fetch error:", e);
    }
  }

  return (
    <>
      <Dashboard
        initialAuctions={initialAuctions || []}
        initialPurchasedLeads={purchasedLeads}
      />
    </>
  );
}

