
-- Add objection_playbook column to call_scripts to store the bundled objection playbook JSON
ALTER TABLE public.call_scripts ADD COLUMN objection_playbook jsonb DEFAULT NULL;
