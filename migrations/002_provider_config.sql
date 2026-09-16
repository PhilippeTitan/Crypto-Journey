-- 002_provider_config.sql
-- Stores AI provider API keys and selected models per provider.

CREATE TABLE IF NOT EXISTS provider_config (
  id            SERIAL PRIMARY KEY,
  provider_key  VARCHAR(64) NOT NULL UNIQUE,   -- e.g. 'openai', 'gemini', 'opencode'
  api_key       TEXT,                           -- encrypted or plain API key
  custom_endpoint TEXT,                         -- for providers that need custom URLs (azure, opencode)
  selected_model VARCHAR(256),                  -- user's chosen model for this provider
  is_active     BOOLEAN DEFAULT false,          -- whether this provider is the active one
  discovered_models JSONB DEFAULT '[]'::jsonb,  -- last model discovery cache
  last_discovered_at TIMESTAMPTZ,              -- when models were last fetched
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by provider key
CREATE INDEX IF NOT EXISTS idx_provider_config_key ON provider_config(provider_key);

-- Insert a row for the current active provider (from .env)
INSERT INTO provider_config (provider_key, is_active)
VALUES ('openai', true)
ON CONFLICT (provider_key) DO NOTHING;
