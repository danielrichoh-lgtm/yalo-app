/*
# Create restaurant_users table + extend Restaurants

## Summary
Creates the `restaurant_users` join table that maps Supabase Auth users to restaurants with
a specific role (admin, super_admin). Also adds `direccion` and `telefono` columns to Restaurants
for the admin panel.

## New Tables
- `restaurant_users`
  - `id` uuid primary key
  - `user_id` uuid — references auth.users, FK with cascade delete
  - `restaurant_id` uuid — references Restaurants, FK with cascade delete
  - `rol` text — 'admin' or 'super_admin'
  - `email` text — stored for display purposes (avoids joining auth.users which is not client-accessible)
  - `created_at` timestamptz
  - UNIQUE(user_id, restaurant_id) prevents duplicate assignments

## Modified Tables
- `Restaurants`: added `direccion text` and `telefono text` columns for address/phone display in admin panel

## Security
- RLS enabled on restaurant_users
- SELECT policy: any authenticated user can read role assignments (non-sensitive data; needed for
  login checks and admin dashboard display)
- INSERT/UPDATE/DELETE intentionally restricted to service role (edge function) only — no client policies
  for writes, preventing self-elevation of privileges

## Important Notes
1. The `email` column is duplicated from auth.users for display convenience. The edge function
   that creates users is responsible for keeping it in sync.
2. No client-side INSERT policy means the only way to create role assignments is via the
   `create-restaurant-user` edge function which uses the service role key.
*/

CREATE TABLE IF NOT EXISTS restaurant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES "Restaurants"(id) ON DELETE CASCADE,
  rol text NOT NULL DEFAULT 'admin',
  email text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_restaurant_users" ON restaurant_users;
CREATE POLICY "authenticated_select_restaurant_users" ON restaurant_users
FOR SELECT TO authenticated
USING (true);

-- Add direccion and telefono to Restaurants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurants' AND column_name = 'direccion') THEN
    ALTER TABLE "Restaurants" ADD COLUMN direccion text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurants' AND column_name = 'telefono') THEN
    ALTER TABLE "Restaurants" ADD COLUMN telefono text NOT NULL DEFAULT '';
  END IF;
END $$;
