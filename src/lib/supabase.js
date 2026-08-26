import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = (rawUrl && rawUrl.startsWith('http')) 
  ? rawUrl.trim() 
  : 'https://hyptntjxfhyefytfxsgc.supabase.co';

const supabaseAnonKey = (rawKey && rawKey.length > 20) 
  ? rawKey.trim() 
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cHRudGp4Zmh5ZWZ5dGZ4c2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTYxNDIsImV4cCI6MjEwMzIzMjE0Mn0.FMsl49ypSrLE-T76Ffvz870myT4eX_lmbjcNwi4ONGE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
