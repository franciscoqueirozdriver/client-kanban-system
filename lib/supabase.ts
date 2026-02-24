import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

/**
 * Service Role Client for server-side operations that bypass RLS.
 * Should only be used in API routes or Server Components.
 */
export const getSupabaseServiceRole = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
  }
  return createClient(supabaseUrl || '', serviceRoleKey);
};
