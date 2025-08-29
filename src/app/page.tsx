import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/utils/supabase/server";
import type { Auction } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();

  const { data: initialAuctions, error } = await supabase
    .from("auctions")
    .select("*, leads(*)")
    .eq("status", "open")
    .gt("expired_at", new Date().toISOString());

  if (error) {
    console.error("Erro ao buscar leilões iniciais:", error.message);
    return <Dashboard initialAuctions={[]} />;
  }

  return (
    <>
      <Dashboard initialAuctions={initialAuctions as Auction[]} />
    </>
  );
}
