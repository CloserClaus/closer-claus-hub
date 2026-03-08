-- Auto-provision lead_credits when a workspace is created (similar to workspace_credits trigger)
CREATE OR REPLACE FUNCTION public.create_workspace_lead_credits()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.lead_credits (workspace_id, credits_balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-provision lead_credits on workspace creation
CREATE TRIGGER create_lead_credits_on_workspace
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_workspace_lead_credits();

-- Backfill: create lead_credits for any existing workspaces that don't have them
INSERT INTO public.lead_credits (workspace_id, credits_balance)
SELECT w.id, 0
FROM public.workspaces w
LEFT JOIN public.lead_credits lc ON lc.workspace_id = w.id
WHERE lc.id IS NULL
ON CONFLICT (workspace_id) DO NOTHING;