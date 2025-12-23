
import { createClient } from '@supabase/supabase-js';

// No Vite, variáveis devem ser prefixadas com VITE_ para serem expostas ao cliente
// Fix: Use process.env instead of import.meta.env to resolve TypeScript error as it's defined in vite.config.ts
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dztdehxipfuguixpnocv.supabase.co';
// Fix: Use process.env instead of import.meta.env to resolve TypeScript error
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6dGRlaHhpcGZ1Z3VpeHBub2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NjQ1NjAsImV4cCI6MjA3OTI0MDU2MH0.eqZdz0w_HYXUMrSlythST-gGnash8TXXVCxexQRW9Go';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
