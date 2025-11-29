
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = 'https://nhelzzgmrhybzjgqkfzc.supabase.co';
// The API Key has been cleaned and concatenated into a single string to prevent syntax errors.
const PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWx6emdtcmh5YnpqZ3FrZnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzc3MTMsImV4cCI6MjA3OTkxMzcxM30.rfOi-bpdsRu6x2UZSajWB4_56cm43u6h5O4KKtpbJz4';

export const supabase = createClient(PROJECT_URL, PUBLIC_KEY);

/**
 * ==========================================
 * SUPABASE SQL SETUP (Run this in SQL Editor)
 * ==========================================
 * 
 * -- 1. Create the trips table
 * create table if not exists public.trips (
 *   id text not null primary key,
 *   user_id uuid not null references auth.users on delete cascade,
 *   trip_data jsonb not null,
 *   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- 2. Enable Row Level Security (RLS)
 * alter table public.trips enable row level security;
 * 
 * -- 3. Create Security Policies
 * drop policy if exists "Users can manage their own trips" on public.trips;
 * 
 * create policy "Users can manage their own trips"
 * on public.trips for all
 * using (auth.uid() = user_id)
 * with check (auth.uid() = user_id);
 */
