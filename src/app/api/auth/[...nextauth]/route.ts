import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const TWO_HOURS_IN_SECONDS = 60;

if (!googleClientId || !googleClientSecret) {
    throw new Error("As variáveis de ambiente GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem ser definidas");
}

const handler = NextAuth({
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
        strategy: 'jwt',
        maxAge: TWO_HOURS_IN_SECONDS,
    },
    jwt: {
        maxAge: TWO_HOURS_IN_SECONDS,
    },
    callbacks: {
        async signIn({ user }) {
            if (user.email && user.email.endsWith('@assessorialpha.com')) {
                return true;
            } else {
                return false;
            }
        },
    },
});

export { handler as GET, handler as POST };
