import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

export function getSupabaseBrowserClient() {
  if (!supabaseClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  }

  return supabaseClient
}
