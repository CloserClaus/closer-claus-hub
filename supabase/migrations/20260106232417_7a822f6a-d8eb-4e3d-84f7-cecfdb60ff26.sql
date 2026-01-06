-- Update the reassign_leads_on_member_removal function to also reassign deals
CREATE OR REPLACE FUNCTION public.reassign_leads_on_member_removal()
RETURNS TRIGGER AS $$
DECLARE
  leads_count INTEGER;
  deals_count INTEGER;
  sdr_name TEXT;
BEGIN
  -- Only trigger when a member is being removed (removed_at changes from NULL to a value)
  IF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
    -- Get SDR name for notification
    SELECT full_name INTO sdr_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Reassign leads - set assigned_to to NULL so agency owner can reassign
    UPDATE public.leads
    SET assigned_to = NULL, updated_at = now()
    WHERE workspace_id = NEW.workspace_id AND assigned_to = NEW.user_id;
    
    GET DIAGNOSTICS leads_count = ROW_COUNT;

    -- Reassign deals - assign to workspace owner
    UPDATE public.deals
    SET assigned_to = (SELECT owner_id FROM public.workspaces WHERE id = NEW.workspace_id), updated_at = now()
    WHERE workspace_id = NEW.workspace_id AND assigned_to = NEW.user_id;
    
    GET DIAGNOSTICS deals_count = ROW_COUNT;

    -- Log the reassignment
    RAISE NOTICE 'Reassigned % leads and % deals for removed member % from workspace %', 
      leads_count, deals_count, NEW.user_id, NEW.workspace_id;

    -- Create notification for workspace owner about reassigned items if any
    IF leads_count > 0 OR deals_count > 0 THEN
      INSERT INTO public.notifications (user_id, workspace_id, type, title, message, data)
      SELECT 
        w.owner_id,
        NEW.workspace_id,
        'items_reassigned',
        'Items Reassigned',
        CONCAT(
          COALESCE(sdr_name, 'A team member'),
          ' left the team. ',
          leads_count, ' leads and ', deals_count, ' deals have been reassigned to you.'
        ),
        jsonb_build_object(
          'sdr_id', NEW.user_id,
          'sdr_name', sdr_name,
          'leads_count', leads_count,
          'deals_count', deals_count
        )
      FROM public.workspaces w
      WHERE w.id = NEW.workspace_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;