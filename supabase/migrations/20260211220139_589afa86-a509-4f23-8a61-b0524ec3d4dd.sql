ALTER TABLE public.training_materials 
  ADD COLUMN content text DEFAULT NULL;

COMMENT ON COLUMN public.training_materials.content IS 'Inline text content for script-based training materials';