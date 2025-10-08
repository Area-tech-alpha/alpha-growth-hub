export interface Lead {
    id: string;
    name: string;
    description: string;
    status: 'hot' | "high_frozen" | "low_frozen" | 'cold' | 'sold';
    expires_at: string;
    channel: string;
    revenue: string;
    marketing_investment: string;
    company_name: string;
    contact_name: string;
    cnpj: string;
    state: string;
    city: string;
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
    document_url: string;
    contract_url: string;
    contract_time: string;
    contract_value: number;
    cal_url?: string;
    briefing_url?: string;
    tags: string[];
    [key: string]: unknown;
}

export interface PurchasedLead {
    lead: Lead;
    purchaseDate: Date;
    purchasePrice: number;
}