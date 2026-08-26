# Change Plan — Event IQ

Status: **DRAFT — investigation only, no code changed.** Review and approve items (or leave comments) before implementation begins. Each item lists files involved, current state, proposed approach, open decisions, and rough complexity.

---

## 1. BUG — Match % mismatch (Matches tab vs Full Profile)

**Files:**
- [src/components/matches/MatchesTab.tsx:142-197](src/components/matches/MatchesTab.tsx) — uses `getViewerMatchMetrics` from [src/lib/checkedInMatches.ts:15-26](src/lib/checkedInMatches.ts)
- [src/lib/matchDetail.ts:136-152](src/lib/matchDetail.ts) — `orientStoredMatch`, used by Full Profile
- [src/components/matches/FullProfileView.tsx:196](src/components/matches/FullProfileView.tsx)
- **Real culprit:** [src/pages/v2/Dashboard.tsx:386-392, 500](src/pages/v2/Dashboard.tsx) (Home tab's "Don't Leave Without Meeting" query)

**Current state:** MatchesTab and Full Profile both correctly compute the viewer-directional score from `a_to_b_score`/`b_to_a_score` (Rubric V2) and agree with each other. The actual discrepancy is a **third display** on the Home tab, which still queries the legacy `match_score` column (`.gte("match_score", 75)`, `score: match.match_score ?? 0`). Since Rubric V2 only populates the directional columns, `match_score` is stale/null for newer matches, producing a different number than the Matches tab / Full Profile for the same match.

**Fix approach:** Update the Dashboard.tsx Home-tab query to select `a_to_b_score`/`b_to_a_score` (+confidence) and reuse `getViewerMatchMetrics` / `selectTopCheckedInMatches` from `checkedInMatches.ts`, same as MatchesTab. Update the `.gte("match_score", 75)` filter accordingly.

**Open decisions:** None — this is a "use the V2 field consistently" fix once confirmed that's the actual pair of screens you're comparing. Confirm you were comparing Home vs. Full Profile (not Matches tab vs. Full Profile) — if it really is Matches tab vs. Full Profile, that needs a fresh look since those two use the same logic today.

**Complexity:** Small.

---

## 2. Rename "People" tab → "Matches"

**Files:**
- [src/pages/v2/Dashboard.tsx:33-38](src/pages/v2/Dashboard.tsx) — `NAV_LABELS.matches = "People"` (label only; internal key `"matches"` unaffected)
- [src/components/matches/MatchesTab.tsx:251,253](src/components/matches/MatchesTab.tsx) — "People worth knowing" / "People you should meet at..."
- [src/pages/v2/Dashboard.tsx:979,983](src/pages/v2/Dashboard.tsx) — "Your people" / "People You Met" stat block
- [src/pages/v2/Dashboard.tsx:613](src/pages/v2/Dashboard.tsx) — "People registered" (event attendance stat, **not** the tab — needs your call on whether it changes too)
- Tests: `DashboardConciergeNavigation.test.tsx:154,166,169,197,198`, `MatchesTabRoomState.test.tsx:66,89` (helper name `ControlledPeople`, not user-facing), `FullProfileView.test.tsx:27` (default back-label)

**Current state:** "People" appears as a nav label plus several copy strings. Internal routing/state keys already use `"matches"`, so renaming is purely cosmetic — no risk of breaking navigation logic.

**Fix approach:** Update all user-facing "People" strings to "Matches" (or appropriate phrasing per string), update affected tests' expected text.

**Open decisions:** Does "People registered" (event attendance count on Home, unrelated to the tab) also get renamed, or stay as-is since it's not about the tab?

**Complexity:** Small.

---

## 3. Rooms font size too large / inconsistent with homepage

**Files:**
- Rooms = `EventsTab`, inline in [src/pages/v2/Dashboard.tsx:1015-1193](src/pages/v2/Dashboard.tsx)
- Rooms heading: [Dashboard.tsx:1175](src/pages/v2/Dashboard.tsx) — `<h1 className="font-display text-4xl">Your rooms</h1>` (flat size, no responsive scaling, older `font-display` family)
- Homepage heading for comparison: [Dashboard.tsx:594](src/pages/v2/Dashboard.tsx) — `font-offrip-display text-3xl font-black uppercase tracking-tight sm:text-4xl`
- Section h2's on Home: `text-2xl` ([:627, 644, 682, 762](src/pages/v2/Dashboard.tsx)); Rooms event card title `text-lg` ([:1137](src/pages/v2/Dashboard.tsx)), metadata `text-xs` ([:1138](src/pages/v2/Dashboard.tsx)) — these already look reasonably sized, mismatch is mainly the h1.

**Do-not-touch clarification:** ⚠️ The "Don't Leave Without Meeting" section is actually rendered inside **HomeTab**, not inside Rooms/EventsTab — [Dashboard.tsx:679-703](src/pages/v2/Dashboard.tsx). They're two separate render branches. A Rooms-only font fix won't touch it either way, but flagging so we're aligned on what "Rooms section" means before editing.

**Fix approach:** Align `Dashboard.tsx:1175` heading classes with the homepage pattern (`font-offrip-display text-3xl sm:text-4xl font-black uppercase tracking-tight`); check the `:1176` subtitle and `:1181` "Upcoming" label for the same family/size swap.

**Open decisions:** Confirm the "without meeting" section you want left alone is the one at Dashboard.tsx:679-703 (in Home, not Rooms) — if so, no conflict since we're only touching Rooms/EventsTab lines.

**Complexity:** Small.

---

## 4. Real photos instead of placeholders (Home, Rooms, elsewhere)

**Files:**
- Avatar system: [src/components/ui/avatar.tsx](src/components/ui/avatar.tsx) — shadcn `Avatar`/`AvatarImage`/`AvatarFallback`, driven by `avatar_url` with initials fallback
- Correctly wired examples: `MatchesTab.tsx:390-393`, `FullProfileView.tsx:182-183`, `MessagesTab.tsx:180-185`, `MessageThread.tsx:456-461`, `Dashboard.tsx:656-661, 704-709, 733-740, 772-777` (Home tab meetings/top matches/connections)
- **Rooms tab (`EventsTab`, Dashboard.tsx:1015-1193) renders no avatars at all** — event cards show name/venue/date/location only, no attendee photos.

**Current state:** No hardcoded/generic placeholder image URLs found anywhere (checked for dicebear/ui-avatars/placeholder patterns — none). The existing `avatar_url` + initials-fallback pattern is used correctly everywhere it's used. Rooms simply doesn't render any avatars — it's an absence, not a broken placeholder.

**Fix approach:** Depends on scope clarification below. If it's "add attendee photos to Rooms cards," that's a matter of adding an `Avatar`/`AvatarImage` using the existing pattern where event cards render.

**Open decisions:** ⚠️ This item's premise doesn't match what's in the code — there's no "wrong placeholder" bug to fix, since nothing renders a broken/generic image today. Please clarify: (a) is this about adding avatars to Rooms cards where none currently appear, or (b) is there a specific screen where you've seen an actual placeholder/broken image (e.g. an empty state, or somewhere not covered above) — a screenshot or exact screen name would help pin this down.

**Complexity:** Unclear until scoped — small if it's "add avatars to Rooms cards using the existing Avatar pattern."

---

## 5. Messages: clicking a person's name navigates to their profile

**Files:**
- [src/components/messages/MessageThread.tsx:449-462](src/components/messages/MessageThread.tsx) — header currently renders `other.full_name` as plain static text, no `onClick`
- [src/components/messages/MessageThread.tsx:119,128](src/components/messages/MessageThread.tsx) — `matchId` already available as a prop
- Established navigation pattern: `onViewFullProfile(matchId: string)` — wired at [Dashboard.tsx:317-323](src/pages/v2/Dashboard.tsx) into `HomeTab`, `MyDayTab`, `MatchesTab`; sets `viewingMatchId` state ([Dashboard.tsx:132](src/pages/v2/Dashboard.tsx)) which renders `<FullProfileView matchId={viewingMatchId} .../>` ([Dashboard.tsx:251-252](src/pages/v2/Dashboard.tsx))
- **Gap:** [src/components/messages/MessagesTab.tsx:53](src/components/messages/MessagesTab.tsx) props don't include/forward `onViewFullProfile`; Dashboard.tsx:296-303's `<MessagesTab>` call doesn't pass one either.

**Fix approach:** Add `onViewFullProfile: (matchId: string) => void` prop to `MessagesTab` and thread it into `MessageThread`; make the header name element a `<button onClick={() => onViewFullProfile(matchId)}>`; wire `Dashboard.tsx:296-303` to pass `setViewingMatchId`, matching the pattern already used for the other three tabs.

**Open decisions:** None — this follows an existing, proven pattern exactly.

**Complexity:** Small.

---

## 6. "Save for later" bookmark on match cards

**Files:**
- `match_actions` table (already exists): [supabase/migrations/20260624020108_..._.sql:135-147](supabase/migrations) — includes `'match_saved'` as a valid `action_type` already, with RLS SELECT+INSERT policies for `auth.uid() = user_id`. **No UPDATE/DELETE policy exists.**
- Currently only `message_sent` actions are ever inserted, via [src/lib/connectRequest.ts:48-53](src/lib/connectRequest.ts). Nothing reads/writes `match_saved` today.
- Match cards: `MatchCard` function in [MatchesTab.tsx:327+](src/components/matches/MatchesTab.tsx), with room near the score badge (`:405-410`) for a bookmark button.

**Current state:** Schema support for "saved" already exists and needs no new table — `match_actions.action_type = 'match_saved'` is ready to use. What's missing: (1) any code that writes/reads it, (2) an "unsave" mechanism, (3) a UI surface to view saved matches.

**Fix approach:** Insert a `match_actions` row with `action_type: 'match_saved'` on click (mirror `connectRequest.ts`'s insert pattern). For unsaving, either add a DELETE RLS policy (`USING (auth.uid() = user_id)`) and delete the row, or extend the CHECK constraint with an `'match_unsaved'` action type and treat "most recent action wins" — needs a decision. Add a bookmark icon to `MatchCard`. For viewing saved matches, add either a new nav tab or a filter/toggle within the Matches tab.

**Open decisions:**
1. Unsave strategy: DELETE row (needs new RLS policy, one small migration) vs. append a new action type (needs CHECK constraint migration + "latest wins" query logic). Recommend DELETE — simpler.
2. Where does the "view saved matches" surface live — a new tab, or a filter/toggle inside the existing Matches tab? Recommend a toggle inside Matches tab to avoid adding nav clutter, but your call.

**Complexity:** Medium (small migration for RLS + new UI surface).

---

## 7. Show pending meeting request on profile page

**Files:**
- [src/components/matches/FullProfileView.tsx](src/components/matches/FullProfileView.tsx) — currently has **zero** references to `meetings`/`requester_id`/`recipient_id`.
- `meetings` table columns confirmed: `requester_id`, `recipient_id` (NOT NULL, `CHECK (requester_id <> recipient_id)`), `status`, `match_id`, `event_id` — [supabase/migrations/20260813232726_complete_meeting_lifecycle_schema.sql:21-22,35](supabase/migrations)
- Existing usage pattern for reference: [MessageThread.tsx:173,300](src/components/messages/MessageThread.tsx) selects `id, status, requester_id, recipient_id, requested_at, scheduled_at, location_note, duration_minutes, completed_at` keyed by `match_id`.

**Fix approach:** In `FullProfileView`'s data load (or alongside `fetchMatchDetail` in [src/lib/matchDetail.ts](src/lib/matchDetail.ts)), add a query for `meetings` filtered by `match_id = matchId` and `status = 'requested'`, then render a pending-request banner/CTA on the profile. `match_id` is the cleanest join key since `MessageThread` already keys meetings this way.

**Open decisions:** What should the banner offer — just a status note ("Meeting request pending"), or actionable buttons (accept/decline) right from the profile view, duplicating what's available in Messages? Recommend a status-only banner that deep-links to the message thread, to avoid duplicating the accept/decline RPC logic in two places.

**Complexity:** Small–medium.

---

## 8. Post-meeting-complete "Was this connection valuable?" prompt

**Files:**
- Meeting completion trigger: [MessageThread.tsx:437](src/components/messages/MessageThread.tsx) — calls `supabase.rpc("complete_meeting", { p_meeting_id: meeting.id })`; completed state rendered at [MessageThread.tsx:577](src/components/messages/MessageThread.tsx)
- `feedback` table (existing, event-level only, **no meeting_id/match_id column**): [supabase/migrations/20260624020108_..._.sql:229-245](supabase/migrations) — columns: `id, event_id, user_id, overall_rating, matching_rating, networking_quality, would_return, highlights, improvements, submitted_at`. RLS: any authenticated user can SELECT all rows; INSERT only own; no UPDATE/DELETE policy.
- No existing feedback UI anywhere in `src/components`/`src/pages` (only unrelated onboarding copy matched "feedback").

**Current state:** The `feedback` table exists but is scoped to an event, not a specific meeting — it can't currently record "was *this* meeting valuable." No feedback UI exists yet to extend.

**Fix approach:** Add a migration for a nullable `meeting_id UUID REFERENCES public.meetings(id)` (and/or `match_id`) column on `feedback` — nullable so existing event-level rows remain valid. Build a lightweight new prompt component, triggered right after the `complete_meeting` RPC succeeds in MessageThread.tsx (near line 437-448), that inserts a row into `feedback` with `meeting_id` set and a minimal question set (e.g. just `overall_rating`/`would_return`-equivalent for "was this valuable").

**Open decisions:**
1. Reuse `feedback` table with a nullable `meeting_id` column (smaller migration) vs. a separate `meeting_feedback` table (cleaner separation, more migration work). Recommend the nullable-column approach.
2. Exact question(s) for the lightweight prompt — just a yes/no "valuable?" toggle, or a rating scale matching the existing `overall_rating`(1-5) pattern?

**Complexity:** Medium (migration + new UI + trigger wiring).

---

## 9. Home page: show upcoming meetings beyond today, soonest first

**Files:**
- [src/pages/v2/Dashboard.tsx:330-378](src/pages/v2/Dashboard.tsx) (`HomeTab`'s `loadStats`) — gates the entire stats block (including the meetings list) behind finding an `activeEvent` whose date range includes **today**:
  ```ts
  const activeEvent = (events ?? []).find((event) => {
    const start = new Date(`${event.date}T00:00:00`);
    const end = new Date(`${event.end_date ?? event.date}T00:00:00`);
    return start <= today && end >= today;
  });
  if (!activeEvent) { setStats(null); return; }
  ```
  If nothing is happening today, `stats` becomes `null` and the empty state renders ([Dashboard.tsx:602-606](src/pages/v2/Dashboard.tsx)), hiding all future meetings.
- The meetings sub-query itself ([Dashboard.tsx:406-413](src/pages/v2/Dashboard.tsx)) is already reasonably future-friendly *within* an active event (`status='scheduled'`, `scheduled_at` not null, ascending order) — the real bug is the outer today-only gate, not the meeting filter/sort.

**Fix approach:** Decouple the meetings list from the today-only `activeEvent` gate. Either (a) query meetings across all the user's joined/checked-in events regardless of whether an event is live today, filtered to `scheduled_at >= now()`, ordered ascending (soonest first) — this naturally satisfies "3+ days out shows too, soonest on top"; or (b) keep the `activeEvent` gate for the rest of the stats block but run a separate, ungated query specifically for the meetings list.

**Open decisions:** Should the rest of the "Your Day" stats block (not just meetings) also stop being gated by "event happening today," or is it just the meetings list that needs to become event-date-independent? Recommend (b) — least disruptive, scoped to what was asked.

**Complexity:** Medium (touches the stats-loading structure, not a one-line filter tweak).

---

## 10. Show which event a match came from

**Files:**
- MatchesTab: `eventName` is already available in scope from `selectedEvent.name` ([MatchesTab.tsx:244](src/components/matches/MatchesTab.tsx)) and already passed into `MatchCard` as a prop ([MatchesTab.tsx:319,329,333](src/components/matches/MatchesTab.tsx)) — but confirmed **never rendered visibly** in the card JSX ([MatchesTab.tsx:376-410+](src/components/matches/MatchesTab.tsx)). Currently only used for connect-message default text ([:441](src/components/matches/MatchesTab.tsx)).
- FullProfileView: [src/lib/matchDetail.ts:170-213](src/lib/matchDetail.ts) (`fetchMatchDetail`) selects `event_id` and exposes `match.eventId` ([matchDetail.ts:200](src/lib/matchDetail.ts)), used only for `sendConnectRequest` ([FullProfileView.tsx:151](src/components/matches/FullProfileView.tsx)) — no event **name** is fetched or rendered anywhere in `FullProfileView.tsx`.

**Fix approach:**
- MatchesTab: no new query needed — just render the already-threaded `eventName` prop somewhere in `MatchCard`'s JSX.
- FullProfileView: either (a) add `events!inner(name)` to the `matches` select in `fetchMatchDetail`, or (b) pass `eventName` down as a prop from whichever screen opens the profile (MatchesTab already has `selectedEvent`, Dashboard has `activeEvent`) — cheaper if the calling screens always have it in scope already.

**Open decisions:** Confirm option (b) is acceptable for FullProfileView (prop-drilling event name from caller) vs. always doing a fresh DB join — (b) avoids extra query but requires every entry point into FullProfileView to have the event name on hand; worth a quick check of all the places FullProfileView gets opened from.

**Complexity:** Small.

---

## Cross-cutting notes

- Items **1, 9, and 10** all touch `Dashboard.tsx`'s `HomeTab`/`loadStats` block (~lines 330-520) — could reasonably be scoped as one PR, separate from the Rooms/People/Messages/save/feedback items which are independent of each other and of Dashboard's Home logic.
- Items **4** (photos) needs a scoping answer from you before work can start — the described bug doesn't match what's currently in the code.
- Items **6** and **8** are the only ones requiring a database migration.
