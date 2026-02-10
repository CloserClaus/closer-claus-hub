-- Auto-create workspace_credits row when a new workspace is created
CREATE OR REPLACE FUNCTION public.create_workspace_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.workspace_credits (workspace_id, credits_balance, free_minutes_remaining)
  VALUES (NEW.id, 0, 1000)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER create_workspace_credits_on_insert
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.create_workspace_credits();