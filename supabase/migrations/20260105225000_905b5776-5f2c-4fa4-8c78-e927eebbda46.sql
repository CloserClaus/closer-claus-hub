CREATE OR REPLACE FUNCTION public.update_sdr_level_on_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deal_value numeric;
  new_total numeric;
  old_level integer;
  new_level integer;
BEGIN
  -- Get the deal value
  SELECT value INTO deal_value FROM public.deals WHERE id = NEW.deal_id;
  
  -- Get current level before update
  SELECT COALESCE(sdr_level, 1) INTO old_level FROM public.profiles WHERE id = NEW.sdr_id;
  
  -- Update the SDR's total deals closed value
  UPDATE public.profiles
  SET total_deals_closed_value = COALESCE(total_deals_closed_value, 0) + deal_value
  WHERE id = NEW.sdr_id
  RETURNING total_deals_closed_value INTO new_total;
  
  -- Calculate and update the new level
  new_level := calculate_sdr_level(new_total);
  
  UPDATE public.profiles
  SET sdr_level = new_level
  WHERE id = NEW.sdr_id;
  
  -- If level increased, create a celebration notification
  IF new_level > old_level THEN
    INSERT INTO public.notifications (
      user_id,
      workspace_id,
      type,
      title,
      message,
      data
    ) VALUES (
      NEW.sdr_id,
      NEW.workspace_id,
      'level_up',
      'Level Up! 🎉',
      CASE new_level
        WHEN 2 THEN 'Congratulations! You''ve reached Level 2 (Silver)! Your platform fee is now reduced to 4%.'
        WHEN 3 THEN 'Amazing! You''ve reached Level 3 (Gold)! Your platform fee is now just 2.5%!'
        ELSE 'You''ve leveled up!'
      END,
      jsonb_build_object(
        'old_level', old_level,
        'new_level', new_level,
        'total_deals_closed', new_total,
        'new_platform_cut', CASE new_level WHEN 3 THEN 2.5 WHEN 2 THEN 4 ELSE 5 END
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;