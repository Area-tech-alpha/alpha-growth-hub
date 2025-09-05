export interface Lead {
    id: string;
    name: string;
    description: string;
    status: 'hot' | "high_frozen" | "low_frozen" | 'cold' | 'sold';
    expires_at: string;
    location: string;
    channel: string;
    revenue: number;
    marketing_investment: number;
    company_name: string;
    contact_name: string;
    cnpj: string;
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
    minimum_value: number;
    category: string;
    tags: string[];
    [key: string]: unknown;
}

export interface PurchasedLead {
    lead: Lead;
    purchaseDate: Date;
    purchasePrice: number;
}