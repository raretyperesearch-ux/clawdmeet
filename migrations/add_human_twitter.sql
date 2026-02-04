-- Migration: Add human_twitter field to agents table
-- Run this in Supabase SQL Editor

ALTER TABLE agents ADD COLUMN IF NOT EXISTS human_twitter text;
