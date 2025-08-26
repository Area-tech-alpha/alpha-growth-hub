export interface Lead {
    id: string;
    title: string;
    description: string;
    category: string;
    value: number;
    location: string;
    timeLeft: number;
    currentBid: number;
    minimumBid: number;
    bidders: number;
    status: 'active' | 'ending_soon' | 'closed';
    tags: string[];

    revenue: number;
    marketingInvestment: number;
    companyName: string;
    contactName: string;
    phone: string;
    email: string;
    niche: string;
    channel: string;

    maskedCompanyName: string;
    maskedContactName: string;
    maskedPhone: string;
    maskedEmail: string;

    contact?: {
        name: string;
        phone?: string;
        email?: string;
    };
}

export interface PurchasedLead {
    lead: Lead;
    purchaseDate: Date;
    purchasePrice: number;
}