-- ============================================================================
-- Add VIN (Vehicle Identification Number) to members
-- ============================================================================
-- Run this once in the Supabase SQL Editor. Safe to run more than once
-- (IF NOT EXISTS makes it a no-op if the column already exists).
--
-- This does NOT require touching any RLS policies from admin_auth_setup.sql —
-- the existing "public read members" / "admin write members" / "admin update
-- members" policies already cover this new column automatically, since
-- Postgres RLS policies apply at the row level, not per-column.
-- ============================================================================

alter table members add column if not exists vin text;
