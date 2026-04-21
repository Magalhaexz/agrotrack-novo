import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis do Supabase não carregadas. Confira o arquivo .env e reinicie o Vite.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);