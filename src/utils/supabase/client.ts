import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) {
        // Safe log: do not print values
        // Helps debug missing env in client bundle
        console.error('[Supabase] Client env missing:', {
            hasUrl: Boolean(url),
            hasAnonKey: Boolean(anon),
        })
    } else {
        // One-time health log (won't expose secrets)
        if (typeof window !== 'undefined') {
            console.log('[Supabase] Client env OK. Initializing browser client')
        }
    }
    return createBrowserClient(
        url!,
        anon!
    )
}
