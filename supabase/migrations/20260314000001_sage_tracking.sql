-- App config table
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_config (key, value, description) VALUES
  ('sage_input_cost_per_million_tokens', '3.00', 'USD cost per million input tokens — update when Anthropic pricing changes'),
  ('sage_output_cost_per_million_tokens', '15.00', 'USD cost per million output tokens — update when Anthropic pricing changes'),
  ('sage_model', 'claude-sonnet-4-20250514', 'Current Anthropic model in use'),
  ('sage_limit_free', '10', 'Monthly Sage interactions allowed on Free tier'),
  ('sage_limit_plus', '100', 'Monthly Sage interactions allowed on Plus tier'),
  ('sage_limit_premium', '1000', 'Monthly Sage interactions soft ceiling on Premium tier')
ON CONFLICT (key) DO NOTHING;

-- Sage usage tracking table
CREATE TABLE IF NOT EXISTS sage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  household_id UUID NOT NULL REFERENCES households(id),
  subscription_tier TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  input_cost_rate DECIMAL(10,8) NOT NULL DEFAULT 0,
  output_cost_rate DECIMAL(10,8) NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform admin flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;

UPDATE users SET is_platform_admin = TRUE
WHERE email = 'mrarichill@gmail.com';

-- RLS policies
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_config"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE sage_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own sage usage"
  ON sage_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sage usage"
  ON sage_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
