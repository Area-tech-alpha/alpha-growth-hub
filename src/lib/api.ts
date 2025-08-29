import type {
  UserProfile,
  AuctionWithLead,
  PurchasedLead,
  BidWithUserName,
} from "@/lib/custom-types";

async function apiFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(errorData.error || "Falha ao comunicar com a API.");
  }
  return response.json();
}

export const fetchUserProfile = (): Promise<UserProfile> =>
  apiFetch("/api/profile/user");

export const fetchActiveAuctions = (): Promise<AuctionWithLead[]> =>
  apiFetch("/api/auctions/active");

export const fetchPurchasedLeads = (): Promise<PurchasedLead[]> =>
  apiFetch("/api/leads/purchased");

export const fetchBidsForAuction = (
  auctionId: string
): Promise<BidWithUserName[]> => apiFetch(`/api/auctions/${auctionId}/bids`);

export const postBid = ({
  auctionId,
  amount,
}: {
  auctionId: string;
  amount: number;
}): Promise<BidWithUserName> => {
  return apiFetch(`/api/auctions/${auctionId}/bids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
};
