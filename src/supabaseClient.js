import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://htsukephqsuqheavlclz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2ussQ1LNWy-G-mUT5xNdAQ_0KLhVyAO'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

