import { type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import type { Adapter, AdapterUser } from "next-auth/adapters"


const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
    throw new Error("As variáveis de ambiente GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem ser definidas");
}

const TWENTY_FOUR_HOURS_IN_SECONDS = 24 * 60 * 60;

const baseAdapter: Adapter = PrismaAdapter(prisma);

export const authOptions: NextAuthOptions = {
    adapter: {
        ...baseAdapter,
        async createUser(data: Omit<AdapterUser, "id">): Promise<AdapterUser> {
            const id = randomUUID();
            const created = await prisma.user.create({
                data: {
                    id,
                    name: data.name ?? null,
                    email: data.email ?? null,
                    emailVerified: data.emailVerified ?? null,
                    image: data.image ?? null,
                },
            });
            return {
                id: created.id,
                name: created.name,
                email: created.email,
                emailVerified: created.emailVerified,
                image: created.image,
            } as AdapterUser;
        },
    },
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
        // async signIn({ user }) {
        //     if (!user.email || !user.email.endsWith('@assessorialpha.com')) {
        //         console.warn('[NextAuth] signIn blocked: invalid domain for', user.email)
        //         return false;
        //     }
        //     return true;
        // },
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
            if (url.startsWith(baseUrl)) return url
            return baseUrl
        },
    },
    events: {
        async signIn({ user }) {
            try {
                if (!user?.id) return;
                await prisma.$executeRawUnsafe(
                    'insert into public.users (id, name, email, email_verified, avatar_url) values ($1, $2, $3, $4, $5) on conflict (id) do update set name = coalesce(excluded.name, public.users.name), email = coalesce(excluded.email, public.users.email), email_verified = coalesce(excluded.email_verified, public.users.email_verified), avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url)',
                    user.id,
                    user.name ?? null,
                    user.email ?? null,
                    null,
                    user.image ?? null
                );
            } catch (err) {
                console.error('[NextAuth][events.signIn] upsert users failed:', err);
            }
        },
    },
};
