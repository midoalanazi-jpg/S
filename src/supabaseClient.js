import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://htsukephqsuqheavlclz.supabase.co'
const supabaseAnonKey = 'sb_publishable_2ussQ1LNWy-G-mUT5xNdAQ_0KLhVyAO'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
