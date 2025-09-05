import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: initialAuctions } = await supabase
    .from("auctions")
    .select("*, leads(*)")
    .eq("status", "open")
    .gt("expired_at", new Date().toISOString());

  return (
    <>
      <Dashboard
        initialAuctions={initialAuctions || []}
        initialPurchasedLeads={[]}
      />
    </>
  );
}

