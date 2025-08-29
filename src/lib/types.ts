import type { ReactNode } from 'react';

/**
 * Representa os dados do usuário logado, incluindo o saldo de créditos.
 * Retornado pelo endpoint: GET /api/user/profile
 */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  creditBalance: number;
}

/**
 * Representa os dados de um único lead.
 * Usado dentro dos objetos Auction e PurchasedLead.
 */
export interface Lead {
  id: string;
  name: string;
  description: string;
  companyName: string;
  contactName: string;
  phone?: string;
  email?: string;
  revenue: number;
  marketingInvestment: number;
  location: string;
  segment: string;
  status?: 'hot' | 'warm' | 'cold'; // Adicionando status opcional
  channel?: string; // Adicionando channel opcional
}

/**
 * Representa um leilão ativo, que inclui os dados do lead associado.
 * Retornado pelo endpoint: GET /api/auctions/active
 */
export interface Auction {
  auctionId: string;
  minimumBid: number;
  currentBid: number;
  bidders?: number; // Adicionando bidders opcional
  expiredAt: string; // ISO Date String
  lead: Lead;
}

/**
 * Representa um lead que foi comprado por um usuário.
 * Retornado pelo endpoint: GET /api/leads/purchased
 */
export interface PurchasedLead {
  purchaseDate: string; // ISO Date String
  purchasePrice: number;
  lead: Lead;
}

/**
 * Representa um único lance no histórico de um leilão.
 * Retornado pelo endpoint: GET /api/auctions/{auctionId}/bids
 */
export interface Bid {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    createdAt: string; 
}

