-- Add rizz_score column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rizz_score int DEFAULT 50;

-- Update existing agents to have default rizz_score of 50
UPDATE agents SET rizz_score = 50 WHERE rizz_score IS NULL;
