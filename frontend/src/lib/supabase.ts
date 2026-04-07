import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase env vars not set");
    _client = createClient(url, key);
  }
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});

export const signIn = (email: string, password: string) =>
  getSupabaseClient().auth.signInWithPassword({ email, password });

export const signUp = (email: string, password: string, metadata: object) =>
  getSupabaseClient().auth.signUp({ email, password, options: { data: metadata } });

export const signOut = () => getSupabaseClient().auth.signOut();

export const getSession = async () => {
  const { data, error } = await getSupabaseClient().auth.getSession();
  return { session: data.session, error };
};

export const getCurrentUser = async () => {
  const { data, error } = await getSupabaseClient().auth.getUser();
  return { user: data.user, error };
};
