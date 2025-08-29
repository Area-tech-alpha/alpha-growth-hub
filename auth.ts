// auth.ts

import { type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
    throw new Error("As variáveis de ambiente GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem ser definidas");
}

const TWENTY_FOUR_HOURS_IN_SECONDS = 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
        }),
    ],
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt",
        maxAge: TWENTY_FOUR_HOURS_IN_SECONDS,
    },
    jwt: {
        maxAge: TWENTY_FOUR_HOURS_IN_SECONDS,
    },
    callbacks: {
        async signIn({ user }) {
            // Permite somente emails do domínio. Ajuste se necessário.
            if (!user.email || !user.email.endsWith('@assessorialpha.com')) {
                console.warn('[NextAuth] signIn blocked: invalid domain for', user.email)
                return false;
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
            // Sempre retorna para a home após login/logout para evitar loops
            if (url.startsWith(baseUrl)) return url
            return baseUrl
        },
    },
    events: {
        // Garante que o usuário de aplicação (tabela `users`) exista no primeiro login
        async signIn({ user }) {
            try {
                if (!user?.id) return;
                // Usa SQL para não depender dos tipos gerados
                await prisma.$executeRawUnsafe(
                    'insert into public.users (id, name, email) values ($1, $2, $3) on conflict (id) do update set name = coalesce(excluded.name, public.users.name), email = coalesce(excluded.email, public.users.email)',
                    user.id,
                    user.name ?? null,
                    user.email ?? null
                );
            } catch (err) {
                console.error('[NextAuth][events.signIn] upsert users failed:', err);
            }
        },
    },
};
