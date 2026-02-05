-- Create RPC function to atomically increment visits
-- This ensures thread-safe incrementing of the visit counter
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
