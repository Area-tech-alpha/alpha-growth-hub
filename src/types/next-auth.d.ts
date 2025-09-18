import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: DefaultSession["user"] & {
            id: string;
        };
        supabaseIdToken?: string;
        supabaseProvider?: string;
    }

    interface User extends DefaultUser {
        id: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        supabaseIdToken?: string;
        supabaseProvider?: string;
    }
}


