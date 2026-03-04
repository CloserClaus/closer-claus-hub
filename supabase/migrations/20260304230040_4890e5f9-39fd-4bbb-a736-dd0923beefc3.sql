
ALTER TABLE signal_runs ADD COLUMN IF NOT EXISTS apify_run_ids JSONB DEFAULT '[]';
ALTER TABLE signal_runs ADD COLUMN IF NOT EXISTS processing_phase TEXT DEFAULT 'pending';
ALTER TABLE signal_runs ADD COLUMN IF NOT EXISTS current_keyword_index INTEGER DEFAULT 0;
