export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  creditBalance: number;
}

export interface Lead {
  id: string;
  name: string;
  description: string;
  companyName: string;
  contactName: string;
  revenue: number;
  marketingInvestment: number;
  location: string;
  segment: string;
}

export interface Auction {
  auctionId: string;
  minimumBid: number;
  currentBid: number;
  expiredAt: string;
  lead: Lead;
}

export interface PurchasedLead {
  purchaseDate: string;
  purchasePrice: number;
  lead: Lead;
}
export interface Bid {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  createdAt: string;
}
