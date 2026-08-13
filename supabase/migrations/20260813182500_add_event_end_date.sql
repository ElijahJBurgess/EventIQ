-- Multi-day events need a calendar end date that is independent of their
-- optional start/end timestamps. NULL preserves existing single-day behavior.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_date date;

UPDATE public.events
SET end_date = DATE '2026-08-13'
WHERE id = '0bdca68e-a936-4f10-9a32-bee99961ffa1'
  AND name = 'Render ATL 2026';
