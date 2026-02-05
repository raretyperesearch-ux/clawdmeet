-- Complete setup for stats tracking
-- Run this in your Supabase SQL editor

-- 1. Create stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS stats (
  id text PRIMARY KEY,
  visits bigint DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 2. Insert initial row if it doesn't exist
INSERT INTO stats (id, visits, created_at, updated_at)
VALUES ('main', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

-- 3. Create RPC function for atomic increment
CREATE OR REPLACE FUNCTION increment_visits()
RETURNS void AS $$
BEGIN
  -- Try to update existing row
  UPDATE stats SET visits = visits + 1, updated_at = now() WHERE id = 'main';
  
  -- If no row was updated (row doesn't exist), insert it
  IF NOT FOUND THEN
    INSERT INTO stats (id, visits, created_at, updated_at) 
    VALUES ('main', 1, now(), now())
    ON CONFLICT (id) DO UPDATE 
    SET visits = stats.visits + 1, updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant execute permission (if needed)
GRANT EXECUTE ON FUNCTION increment_visits() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_visits() TO anon;
