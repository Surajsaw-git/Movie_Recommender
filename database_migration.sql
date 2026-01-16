-- Database Migration: Add trailerUrl column to movie table
-- Run this SQL script to add support for movie trailers

ALTER TABLE movie 
ADD COLUMN IF NOT EXISTS trailerUrl VARCHAR(500) NULL 
AFTER imageUrl;

-- This column will store YouTube trailer URLs
-- Example format: https://www.youtube.com/watch?v=VIDEO_ID
-- or: https://youtu.be/VIDEO_ID

