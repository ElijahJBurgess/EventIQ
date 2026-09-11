# OFFRIP working context

This reference supports future platform changes. It records current behavior and investigation results; it is not an implementation request or an approved backlog. The detailed evidence and rationale are in [the codebase research](OFFRIP_CODEBASE_RESEARCH.md).

## Snapshot and baseline

Reviewed September 10, 2026: local `main` and GitHub `main` both resolved to `d363fd1973452cb806c7a206cad20b44753c90ed`. The checkout was initially clean. Application code was not changed. Compare the current HEAD and working changes with this snapshot before using these notes.

Fresh local baseline on Node 22.15.0 / npm 10.9.2: **394 Vitest tests across 57 files passed; 47 Node tests across five Concierge files passed; TypeScript build checking and the Vite production build passed. ESLint: zero errors, eight warnings.** The eight Deno match-handler tests were not run because Deno was unavailable. No production sessions, database contents, deployed function bundles, credentials, or migration history were verified.

## Product model

OFFRIP is an event networking and relationship application: profile → join event → discover directional matches → request connection → recipient accepts → chat → meeting → feedback/outcomes. Recommendations are deterministic scoring plus explanatory presentation; Concierge is a separate AI Q&A surface. The source contains real persistence and authorization paths, not just screens.

Three access surfaces must stay distinct:

- Attendees: Supabase authentication, `/v2`, completed-profile route gate.
- Organizers: `/v2/organizer`, manually granted `profiles.is_organizer`, own-event management enforced by RLS.
- Owner: `/v2/admin`, shared-password digest accepted by `admin-auth`, global service-role access. The folder name `enterprise` does not mean company tenancy exists.

## Rules and distinctions that matter

1. **Identity:** match generation and account deletion derive the caller from a verified token. A supplied profile ID is not an authority. Match generation accepts `{eventId}`; the legacy `profileId` field is tolerated but ignored.
2. **Event versus person:** matches, messages, and meetings are tied to an event-specific match. The same two people can have different match IDs across events. Personal notes/archive are keyed by user and match, not a universal person relationship.
3. **Direction:** A→B means how well B serves A's needs. UUID ordering determines stored A/B, not requester identity. Scores, confidence, labels, breakdowns, evidence, and details must move together when orientation changes.
4. **Three recommendation selectors:** Home shows up to five viewer-scored rows without a counterpart check-in/confidence filter in its query path. Matches shows up to ten rows with a checked-in counterpart and non-null directional score/confidence, with no 60/70 floor. Concierge uses score ≥60 and confidence ≥70 across events, capped at 50 match rows, without a check-in filter.
5. **Join means check-in:** new joins write `is_checked_in=true`. Presence metrics now represent participation, not independently verified physical attendance. Older registrations can retain the previous distinction.
6. **Connection state:** `matches.connection_status` is the explicit source for none/pending/accepted/declined. Request insertion creates pending via a database trigger; only the pending recipient can respond. Regular messages and meeting requests require acceptance.
7. **Meeting state:** request, response, scheduling, and completion use RPCs. A scheduled meeting is not automatically proof of attendance. Calendar export is an `.ics` download.
8. **Profiles:** onboarding and editing share `buildProfileUpdatePayload`. Keep the `matching_goal`/`primary_goal` and `areas_of_expertise`/`offers` compatibility writes until all readers are traced. Photo, LinkedIn, and eight multi-select fields are required by the current frontend validation.
9. **Read boundaries:** complete profiles are self-only. `attendee_profiles` and `matched_event_attendance` are curated views with explicit caller/match predicates. Changing their execution mode changes the application read contract. Public photo URLs are a separate visibility surface.
10. **Concierge:** `{question,requestId,history,timezone?}`, no `eventId`. It receives selected profile and relationship data and message metadata, not attendee message bodies. It has no tools to send messages or schedule meetings. Browser history is in-memory; retry IDs deduplicate telemetry, not provider calls.
11. **Owner analytics:** management lists all events; analytics gathers published events. Hide/unhide can change analytics inclusion. Funnel stages mix attendee and relationship units; preserve their definitions when changing labels or math.
12. **Delivery:** frontend, Edge Functions, and SQL are separate. The historical CLI permission/migration-drift notes require rechecking, not assuming the same runtime state. Preserve legacy server secret names, particularly `OOO_Intellegence_Open_API_Key`.

## Where future work starts

| Work area | First source files | Related boundary |
|---|---|---|
| Routes, sign-in, recovery | `src/App.tsx`, `src/v2/AuthProvider.tsx`, `src/v2/ProtectedRoute.tsx` | Remote auth redirects/confirmation; profile completion |
| Onboarding and profile edit | `src/pages/v2/ProfileSetup.tsx`, `src/components/profile/EditProfileScreen.tsx`, `src/components/profile-setup/` | Payload aliases, role-detail keys, validation, photo ownership, scorer inputs |
| Home/events/navigation | `src/pages/v2/Dashboard.tsx`, `src/lib/homeStatsEvent.ts` | Tab/overlay state, registrations, event availability, matching invocation |
| Match scores | `supabase/functions/match-engine/{handler,index,scorer,canonical}.ts` | Auth, profile mappings, canonical SQL constraint, persisted score versions |
| Match cards and full profile | `src/components/matches/`, `src/lib/{checkedInMatches,matchDetail,matchExplanation,matchPresentation}.ts` | Viewer direction, filtering, evidence versus shared reason |
| Connection/chat/meetings | `src/lib/connectRequest.ts`, `src/lib/connectionSummary.ts`, `src/components/messages/`, inline Connections/MyDay in Dashboard | Connection/message/meeting migrations; notifications; self-reports |
| Concierge | `supabase/functions/concierge/`, `src/lib/conciergeClient.ts`, `src/components/concierge/` | Context eligibility, output hydration, in-memory history, three test runners |
| Organizer event controls | `src/pages/v2/OrganizerRooms.tsx`, `src/lib/roomForm.ts` | Organizer grant, ownership RLS, deletion-impact RPC |
| Owner console | `src/pages/v2/OrganizerAdmin.tsx`, `src/pages/v2/enterprise/`, `supabase/functions/admin-auth/` | Global password credential, metric definitions, report snapshots |
| Account removal | `supabase/functions/delete-account/`, AuthProvider | Organizer blocking, report attribution, storage cleanup, FK cascades |
| Visual changes | `src/index.css`, `tailwind.config.ts`, `src/components/offrip/`, `src/components/ui/` | Global typography and two component families |

## Known investigation leads, not an automatic repair list

- Dashboard loads no `company`, but Home's colleague RPC is gated by that prop: source-confirmed wiring mismatch.
- Open-thread refresh reloads messages/connection state, not meeting state: likely stale remote meeting changes.
- Concierge and Home pending-request counting still use message history rather than canonical connection state in relevant paths.
- Matches “See Why” renders canonical-A `match_reason` while the percentage is viewer-oriented; Full Profile uses directional evidence.
- Editing a profile refreshes the parent profile only; no direct match-engine invocation follows. Existing-pair rescoring also omits shared-array refresh. Runtime triggers/jobs remain unverified.
- Profile completion is saved before event selection, so “join to finish” is frontend flow rather than an enforced route prerequisite.
- Owner's 72-hour session window exists in browser storage checks; the server accepts the reusable digest without a timestamp/session expiry.

## Validation commands

```bash
npm test
./node_modules/.bin/tsc -b --pretty false
npm run lint
npm run build
node --test --experimental-strip-types \
  supabase/functions/concierge/handler.test.ts \
  supabase/functions/concierge/context.test.ts \
  supabase/functions/concierge/openai.test.ts \
  supabase/functions/concierge/telemetry.test.ts \
  supabase/functions/concierge/liveComparison.test.ts
# Requires Deno; not executed in this research:
deno test supabase/functions/match-engine/handler.test.ts
```

The repository tracks TypeScript build-info files; typechecking can modify them. `generate-types` redirects directly into the tracked generated types file, so a failed command can truncate it. No CI workflows were present in the reviewed tracked tree. Passing mocked/pure tests does not execute real RLS or establish production parity.
