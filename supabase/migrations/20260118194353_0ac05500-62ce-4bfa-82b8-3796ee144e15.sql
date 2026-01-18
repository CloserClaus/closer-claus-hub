-- Add unique constraint on lead_list_items to prevent duplicates
ALTER TABLE public.lead_list_items 
ADD CONSTRAINT lead_list_items_unique_lead_per_list UNIQUE (lead_list_id, apollo_lead_id);