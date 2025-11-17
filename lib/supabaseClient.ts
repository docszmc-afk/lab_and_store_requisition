import { createClient } from '@supabase/supabase-js'

// IMPORTANT: These are the user's public keys. Do not replace them with placeholders.
const supabaseUrl = 'https://fttxgekrdrsdjtgjkqyt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dHhnZWtyZHJzZGp0Z2prcXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwOTIyMDEsImV4cCI6MjA3ODY2ODIwMX0.9ZXwSgeb83Yi7aiYpx3bMT0jQR8P8LL8qgrbXxZyHIA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
