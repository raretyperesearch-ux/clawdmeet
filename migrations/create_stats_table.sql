-- Create stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS stats (
  id text PRIMARY KEY,
  visits bigint DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Insert initial row if it doesn't exist
INSERT INTO stats (id, visits)
VALUES ('main', 0)
ON CONFLICT (id) DO NOTHING;
