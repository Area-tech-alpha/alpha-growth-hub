export interface Lead {
    id: string;
    name: string;
    description: string;
    status: 'hot' | "high_frozen" | "low_frozen" | 'cold' | 'sold';
    expires_at: string;
    location: string;
    channel: string;
    revenue: number;
    marketingInvestment: number;
    companyName: string;
    contactName: string;
    phone: string;
    email: string;
    maskedCompanyName: string;
    niche: string;
    maskedContactName: string;
    maskedPhone: string;
    maskedEmail: string;
    currentBid: number;
    owner_id?: string;
    bidders: number;
    category: string;
    tags: string[];
    [key: string]: unknown;
}

export interface PurchasedLead {
    lead: Lead;
    purchaseDate: Date;
    purchasePrice: number;
}