import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) {
        console.error('[Supabase] Client env missing:', {
            hasUrl: Boolean(url),
            hasAnonKey: Boolean(anon),
        })
    } else {
        if (typeof window !== 'undefined') {
            console.log('[Supabase] Client env OK. Initializing browser client')
        }
    }
    return createBrowserClient(
        url!,
        anon!
    )
}
