-- Applied to the remote project via the Supabase MCP on 2026-09-08.
--
-- match-engine could create mirrored/duplicate match rows: it did a
-- check-then-insert with no atomic guarantee, and the unique constraint
-- (event_id, user_a_id, user_b_id) is directional -- it does not catch a
-- mirrored (event_id, B, A) row. The edge function now (a) always writes the
-- pair in canonical order (user_a_id = the smaller UUID) and (b) upserts on
-- ON CONFLICT (event_id, user_a_id, user_b_id) DO UPDATE.
--
-- This migration:
--   1. Re-orients the existing non-canonical rows (83 of 718 at time of
--      writing) so user_a_id < user_b_id, swapping every direction-dependent
--      column to match -- mirrors match-engine/canonical.ts's swapStoredMatchDirection.
--   2. Adds a CHECK enforcing canonical ordering.
--   3. Adds the covering index on matches(user_a_id, user_b_id).
--
-- Data is demo/seed only -- if the re-orientation gets a transitional field
-- (match_reason / match_score) slightly wrong, "Run Matching" regenerates it.

begin;

-- 1. Re-orient non-canonical rows. RHS expressions see the pre-update row, so
--    e.g. match_evidence->'bToA' below is the OLD bToA half.
update public.matches m
set
  user_a_id = m.user_b_id,
  user_b_id = m.user_a_id,

  a_to_b_score = m.b_to_a_score,
  b_to_a_score = m.a_to_b_score,
  a_to_b_confidence = m.b_to_a_confidence,
  b_to_a_confidence = m.a_to_b_confidence,

  -- transitional shared columns follow the new a->b direction
  match_score = m.b_to_a_score,
  match_reason = coalesce((
    select string_agg(
      (it->>'viewerValue') || ' matches ' || (it->>'candidateValue') || ' (' || (it->>'mapping') || ').',
      ' ' order by w desc, sc desc, ord
    )
    from (
      select x.it, x.ord,
        coalesce(wt.weight, 0) as w,
        (x.it->>'score')::numeric as sc
      from jsonb_array_elements(coalesce(m.match_evidence->'bToA', '[]'::jsonb)) with ordinality as x(it, ord)
      left join (values
        ('goalToValueFit', 35), ('targetPersonFit', 20), ('needToOfferFit', 15),
        ('expertiseFit', 10), ('opportunityCompatibility', 10), ('timingConnectionFit', 5), ('contextFit', 5)
      ) wt(component, weight) on wt.component = x.it->>'component'
      order by w desc, sc desc, x.ord
      limit 3
    ) top3
  ), ''),

  reciprocity_label = case m.reciprocity_label
    when 'They Can Help You' then 'You Can Help Them'
    when 'You Can Help Them' then 'They Can Help You'
    else m.reciprocity_label
  end,

  -- swap the aToB / bToA halves, preserving any other keys
  score_breakdown = case
    when m.score_breakdown is null then null
    else (m.score_breakdown - 'aToB' - 'bToA')
      || jsonb_build_object('aToB', m.score_breakdown->'bToA', 'bToA', m.score_breakdown->'aToB')
  end,
  match_evidence = (m.match_evidence - 'aToB' - 'bToA')
    || jsonb_build_object('aToB', m.match_evidence->'bToA', 'bToA', m.match_evidence->'aToB'),

  -- match_details: swap goalA/goalB, roleA/roleB, and needsOffersAToB/BToA
  match_details = case
    when m.match_details is null then null
    else jsonb_build_object(
      'matchedGoals', coalesce((
        select jsonb_agg((e - 'goalA' - 'goalB') || jsonb_build_object('goalA', e->'goalB', 'goalB', e->'goalA'))
        from jsonb_array_elements(coalesce(m.match_details->'matchedGoals', '[]'::jsonb)) e
      ), '[]'::jsonb),
      'matchedRoles', coalesce((
        select jsonb_agg((e - 'roleA' - 'roleB') || jsonb_build_object('roleA', e->'roleB', 'roleB', e->'roleA'))
        from jsonb_array_elements(coalesce(m.match_details->'matchedRoles', '[]'::jsonb)) e
      ), '[]'::jsonb),
      'matchedInterests', coalesce(m.match_details->'matchedInterests', '[]'::jsonb),
      'needsOffersAToB', coalesce(m.match_details->'needsOffersBToA', '[]'::jsonb),
      'needsOffersBToA', coalesce(m.match_details->'needsOffersAToB', '[]'::jsonb)
    ) || (m.match_details - 'matchedGoals' - 'matchedRoles' - 'matchedInterests' - 'needsOffersAToB' - 'needsOffersBToA')
  end
where m.user_a_id > m.user_b_id;

-- 2. Enforce canonical ordering going forward.
alter table public.matches
  add constraint matches_user_a_before_b check (user_a_id < user_b_id);

-- 3. Covering index flagged in the same investigation.
create index if not exists matches_user_a_id_user_b_id_idx
  on public.matches (user_a_id, user_b_id);

commit;
