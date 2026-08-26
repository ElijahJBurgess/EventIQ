-- "Save for later" (item 6): unsaving a match deletes its own
-- match_actions row (action_type = 'match_saved'). GRANT already includes
-- DELETE for authenticated; RLS just never had a policy allowing it.
CREATE POLICY "Users can delete own match actions"
  ON public.match_actions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
