-- Matching Rubric V2 storage. This migration is intentionally additive so
-- existing match IDs and all foreign-key references remain intact.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS a_to_b_score integer,
  ADD COLUMN IF NOT EXISTS b_to_a_score integer,
  ADD COLUMN IF NOT EXISTS a_to_b_confidence integer,
  ADD COLUMN IF NOT EXISTS b_to_a_confidence integer,
  ADD COLUMN IF NOT EXISTS reciprocity_label text,
  ADD COLUMN IF NOT EXISTS score_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS match_evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_a_to_b_score_range
    CHECK (a_to_b_score IS NULL OR a_to_b_score BETWEEN 0 AND 100),
  ADD CONSTRAINT matches_b_to_a_score_range
    CHECK (b_to_a_score IS NULL OR b_to_a_score BETWEEN 0 AND 100),
  ADD CONSTRAINT matches_a_to_b_confidence_range
    CHECK (a_to_b_confidence IS NULL OR a_to_b_confidence BETWEEN 0 AND 100),
  ADD CONSTRAINT matches_b_to_a_confidence_range
    CHECK (b_to_a_confidence IS NULL OR b_to_a_confidence BETWEEN 0 AND 100),
  ADD CONSTRAINT matches_reciprocity_label_check
    CHECK (
      reciprocity_label IS NULL
      OR reciprocity_label IN (
        'You Can Help Each Other',
        'They Can Help You',
        'You Can Help Them',
        'Potential Connection'
      )
    ),
  ADD CONSTRAINT matches_score_version_not_blank
    CHECK (length(btrim(score_version)) > 0),
  ADD CONSTRAINT matches_score_breakdown_object
    CHECK (score_breakdown IS NULL OR jsonb_typeof(score_breakdown) = 'object'),
  ADD CONSTRAINT matches_match_evidence_object
    CHECK (jsonb_typeof(match_evidence) = 'object');

COMMENT ON COLUMN public.matches.a_to_b_score IS
  'Rubric V2 directional compatibility: value of user B to user A.';
COMMENT ON COLUMN public.matches.b_to_a_score IS
  'Rubric V2 directional compatibility: value of user A to user B.';
COMMENT ON COLUMN public.matches.a_to_b_confidence IS
  'Confidence in a_to_b_score; independent of compatibility.';
COMMENT ON COLUMN public.matches.b_to_a_confidence IS
  'Confidence in b_to_a_score; independent of compatibility.';
COMMENT ON COLUMN public.matches.reciprocity_label IS
  'Relationship label derived from both directional scores; never used to lower either score.';
COMMENT ON COLUMN public.matches.score_breakdown IS
  'Both directional component scores, weights, evidence, applicable denominator, and weighted points.';
COMMENT ON COLUMN public.matches.match_evidence IS
  'Exact viewer/candidate fields and mappings that contributed positive points in each direction.';
