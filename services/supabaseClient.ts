
import { createClient } from '@supabase/supabase-js';

// Tenta usar variáveis de ambiente do Vite (Padrão Vercel), caso contrário usa os valores hardcoded.
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://dztdehxipfuguixpnocv.supabase.co';
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6dGRlaHhpcGZ1Z3VpeHBub2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NjQ1NjAsImV4cCI6MjA3OTI0MDU2MH0.eqZdz0w_HYXUMrSlythST-gGnash8TXXVCxexQRW9Go';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true, // Habilitado para manter o usuário logado
    autoRefreshToken: true,
  }
});
