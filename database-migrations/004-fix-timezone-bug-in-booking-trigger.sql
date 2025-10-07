-- Fix timezone bug in enforce_bookable_provider_payer trigger
--
-- PROBLEM: The trigger was using DATE(NEW.start_time) which extracts the UTC date,
-- causing appointments after 6 PM Mountain Time to be validated against the wrong day.
--
-- SOLUTION: Use (NEW.start_time AT TIME ZONE 'America/Denver')::date to get the
-- correct Mountain Time date for validation.
--
-- Date: October 6, 2025

CREATE OR REPLACE FUNCTION public.enforce_bookable_provider_payer()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_row record;
  v_dos date := (NEW.start_time AT TIME ZONE 'America/Denver')::date;  -- FIX: Use MT date instead of UTC
  v_appt tstzrange := tstzrange(NEW.start_time, NEW.end_time, '[]');
  v_tz text := 'America/Denver';
BEGIN
  IF NEW.payer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.*
  INTO v_row
  FROM public.bookable_provider_payers_v2 b
  WHERE b.payer_id = NEW.payer_id
    AND v_dos <@ b.effective
    AND b.bookable_from_date <= v_dos
    AND (
         (b.attending_provider_id IS NULL AND b.provider_id = NEW.provider_id)
      OR (b.attending_provider_id = NEW.provider_id
          AND NEW.rendering_provider_id IS NOT NULL
          AND b.provider_id = NEW.rendering_provider_id)
      OR (b.provider_id = NEW.provider_id
          AND NEW.rendering_provider_id IS NOT NULL
          AND b.attending_provider_id = NEW.rendering_provider_id)
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not bookable for this payer on the selected date';
  END IF;

  IF v_row.requires_co_visit THEN
    IF NEW.rendering_provider_id IS NULL OR NEW.rendering_provider_id = NEW.provider_id THEN
      RAISE EXCEPTION 'This payer requires a co-visit';
    END IF;
  END IF;

  IF v_row.via = 'direct' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.expand_available_slots(NEW.provider_id, NEW.service_instance_id, v_dos, v_dos, v_tz) s
      WHERE v_appt <@ s.slot_range
    ) THEN
      RAISE EXCEPTION 'Chosen time is not available for the selected provider (direct).';
    END IF;
    RETURN NEW;
  END IF;

  IF v_row.via = 'supervised' AND v_row.requires_co_visit THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.co_visit_overlapping_slots(
             v_row.provider_id,
             v_row.attending_provider_id,
             NEW.service_instance_id,
             v_dos, v_dos, v_tz
           ) ov
      WHERE v_appt <@ ov.overlap_range
    ) THEN
      RAISE EXCEPTION 'Chosen time is not available as an overlap between resident and attending';
    END IF;
    RETURN NEW;
  END IF;

  IF v_row.via = 'supervised' AND NOT v_row.requires_co_visit THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.expand_available_slots(v_row.provider_id, NEW.service_instance_id, v_dos, v_dos, v_tz) s
      WHERE v_appt <@ s.slot_range
    ) THEN
      RAISE EXCEPTION 'Chosen time is not available for the resident';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END
$function$;
