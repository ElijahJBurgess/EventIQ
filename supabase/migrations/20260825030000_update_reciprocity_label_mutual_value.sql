-- The matching rubric spec (Part 1 fix) renamed the mutual-reciprocity label
-- from "You Can Help Each Other" to "Mutual Value" and changed its threshold
-- from 70/70 to 60/60. The app-layer scorer.ts was updated, but this CHECK
-- constraint was not, so every UPDATE that computed the new label started
-- failing with a constraint violation -- aborting match-engine's per-user
-- rescoring loop partway through (independent per-row UPDATEs already
-- committed before the violation stayed committed, producing a silent
-- partial-success pattern).
--
-- Both label strings are allowed here: "Mutual Value" for newly (re)scored
-- rows, "You Can Help Each Other" so existing not-yet-regenerated rows
-- remain valid until the planned bulk regeneration replaces them.

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_reciprocity_label_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_reciprocity_label_check
  CHECK (
    reciprocity_label IS NULL
    OR reciprocity_label IN (
      'Mutual Value',
      'You Can Help Each Other',
      'They Can Help You',
      'You Can Help Them',
      'Potential Connection'
    )
  );
