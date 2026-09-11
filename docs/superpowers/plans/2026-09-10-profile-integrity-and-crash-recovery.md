# Profile Integrity and Crash Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a proposed implementation; no application or database changes have been applied.

**Goal:** Remove unreachable completion requirements, persist selected locations correctly, and replace blank-screen failures with recovery screens.

**Architecture:** Share question eligibility between rendering, cleanup, and completion calculation. Persist structured location alongside existing display text and make location comparison state-aware. Separate dependency-light startup recovery from the React error boundary.

**Tech Stack:** React 18, TypeScript, Vite 5, Supabase/Postgres, Vitest and Testing Library.

**Spec:** The user's three requested fixes in this task; the verified findings and behavior decisions below define their implementation scope.

## Global constraints

- Preserve the existing 50/20/20/10 completion weights and current required-versus-optional questions.
- Preserve free-text/custom locations and existing consumers of `location`.
- Do not make country or state guesses from arbitrary custom text.
- Do not introduce a new service or dependency for crash recovery.
- Do not expose credentials, clear authentication, or automatically loop reloads during recovery.
- Implement and verify locally before applying data repairs or deploying.

## Verified baseline, September 10, 2026

Source: local `main`, commit `d363fd1973452cb806c7a206cad20b44753c90ed`.

Live read-only checks against the configured EventIQ Supabase project returned seven profiles, all with empty `location_city` and `location_state_code`. Five have nonblank legacy locations; each can be uniquely resolved against city plus state. The two blank locations must remain blank. The city table has 5,389 rows and `search_us_cities` successfully returns Atlanta, GA. There are 571 city names shared across states.

Three live profiles store 80%. One of these has no currently eligible question blocks; two do have eligible blocks. No live Creator-at-80 example was observed. Running the actual source scoring and question-selection functions against synthetic Founder and Creator forms reproduced zero visible blocks and an 80% score for both. Do not treat all 80% profiles as eligible for promotion.

Running the actual profile payload builder with a selected Atlanta result emitted `location` but neither structured field. Supabase client creation with missing URL or key throws synchronously. These are source-level reproductions, not end-to-end browser tests.

Targeted existing baseline: `npx vitest run src/components/profile-setup/Page3RoleQuestions.test.tsx src/components/profile-setup/profileUpdate.test.ts src/components/profile-setup/wizardRequiredFields.test.tsx` — 19 tests passed, with React Router future-flag warnings. Current tests do not cover the reproduced defects.

Direct authenticated REST table reads work. The installed Supabase CLI account does not list this project, so SQL migration and Edge Function deployment access remain unverified. No live writes were performed. Do not use credentials belonging to another listed project.

## Task 1: Completion follows questions the user can actually see

**Files:**
- Create `src/components/profile-setup/roleQuestionRules.ts` and its test.
- Create `src/components/profile-setup/profileCompletion.ts` and its test.
- Modify `src/components/profile-setup/Page3RoleQuestions.tsx`, `roleDetailsUtils.ts`, and `profileUpdate.ts`.
- Modify `src/pages/v2/ProfileSetup.tsx` and `src/components/profile/EditProfileScreen.tsx`.
- Extend the existing question, payload, and editor integration tests.

**Root cause:** `ProfileSetup` uses a static role list. The UI requires a Founder *and* Raise Capital/Find Customers or Clients, or a Creator *and* Find Brand Partners. It also creates hiring/career blocks from goals independently of identity. Cleanup contains another copy of these rules. The editor never recalculates the stored score.

**Interfaces:** Move the existing `QuestionBlock` type and `getQuestionBlocks(primaryRole: string, secondaryRoles: string[], primaryGoal: string, secondaryGoals: string[]): QuestionBlock[]` to the pure rules module, preserving its ordering and storage keys. Export `calculateCompletionScore(formData: ProfileSetupFormData): number` from the pure completion module. Both save paths consume it through the shared payload builder after cleaning role details.

- [ ] Add regression fixtures for Founder and Creator with no eligible questions, including secondary identities/goals; assert the unchanged UI shows no fields and completion is 100 when the other weighted sections are filled.

```ts
it.each(["Founder / Co-founder", "Creator / Influencer"])(
  "%s earns the question points when no questions apply", (roleType) => {
    const form = {
      ...initialProfileSetupFormData,
      fullName: "Test Person", roleType, primaryGoal: "Build Community",
      whoToMeet: ["Founders"], location: "Atlanta, GA", offers: ["Advice"],
    };
    expect(getQuestionBlocks(roleType, [], form.primaryGoal, [])).toEqual([]);
    expect(calculateCompletionScore(form)).toBe(100);
  },
);
```

- [ ] Run the new tests and confirm they expose the static-role mismatch before replacing it.
- [ ] Move the current block-selection implementation unchanged into the shared module; make rendering and cleanup use it. Replace the static role-list decision with the actual block list:

```ts
const blocks = getQuestionBlocks(
  formData.roleType, formData.secondaryRoleTypes,
  formData.primaryGoal, formData.secondaryGoals,
);
```

- [ ] Keep the existing weights. Award question points when `blocks.length === 0`; otherwise inspect nonempty answers to fields currently shown in active blocks. Empty objects, inactive namespaces, hidden Founder fields, and `Other.customTitle` must not count. Retain the existing policy that answering visible optional questions can earn points and skipping them is allowed; do not make every optional field mandatory.
- [ ] Clean role details before both saving and scoring, then include `profile_completion_score: calculateCompletionScore(formData)` in the common save payload. Keep `profile_completed` as the separate onboarding lifecycle flag.
- [ ] Test required fundraising/hiring/career answers, optional skipping, empty nested objects, inactive answers, primary/secondary goal changes, and editor save followed by reload. Verify no-field cases earn the same score through signup and edit.
- [ ] Run the profile test group and typecheck; review this change independently before proceeding to data repair.

**Meaning of “stuck”:** Repository consumers do not currently use `profile_completion_score` as the onboarding route gate. They use `profile_completed`. The numeric score is defective; an access-blocking claim is not established by this investigation. Matching confidence also uses its own inputs rather than this percentage.

## Task 2: Save and reload structured locations consistently

**Files:**
- Modify `src/components/profile-setup/profileUpdate.ts`, `Page1BasicInfo.tsx`, and shared validation used by the editor.
- Modify `src/components/profile/EditProfileScreen.tsx`.
- Extend `profileUpdate.test.ts`, `wizardRequiredFields.test.tsx`, and editor persistence tests.
- Modify `supabase/functions/match-engine/scorer.ts` and `supabase/functions/concierge/scorer.ts` together; extend `scorer.test.ts` and retain `concierge/scorerCopy.test.ts`.

**Root cause:** Form state and city selection already capture all three values. The shared payload omits the structured pair; editor loading omits them too. Page 1 naively splits existing/custom strings on commas. The editor can bypass Page 1's selection check.

**Interfaces:** Keep `ProfileSetupFormData`'s existing `location`, `locationCity`, `locationStateCode`, and `locationSelectionType`. The common payload additionally returns `location_city: string | null` and `location_state_code: string | null`. Database-selected values are authoritative; custom unresolved values retain display text with null structured fields. Existing structured values survive unrelated edits. Legacy unresolved values can remain unresolved until explicitly selected or safely backfilled.

- [ ] Add a payload regression test and confirm it fails:

```ts
const payload = buildProfileUpdatePayload({
  ...initialProfileSetupFormData,
  location: "Atlanta, GA", locationCity: "Atlanta", locationStateCode: "GA",
  locationSelectionType: "database",
});
expect(payload).toMatchObject({
  location: "Atlanta, GA", location_city: "Atlanta", location_state_code: "GA",
});
```

- [ ] Include both structured fields in editor selection/hydration; remove comma-splitting as an authority for state data. On explicit custom selection, clear the structured pair. On a new database selection, save the selected city and state. On a typed but unconfirmed replacement, block save rather than silently preserving the old city. Existing untouched legacy display text remains editable without forcing a new location.
- [ ] Write the normalized pair into the shared payload, while retaining `location`. Distinguish city-search request failure from successful zero results; allow retry/custom entry and catch rejected requests.
- [ ] Add round-trip tests for signup, editor, unrelated edits, database-to-custom changes, search failure, and cleared/changed input. Verify reloaded city/state equal the selection.
- [ ] Fix both scorer comparisons to compare city **and state** when available. Normalize compatible legacy `City, ST` values for mixed old/new profiles; compare unresolved legacy/custom text conservatively, without declaring a city-only match to a structured city/state pair. Test Atlanta structured versus Atlanta legacy; equal city names in different states; blank values; case/whitespace; custom non-US locations.
- [ ] Run both scoring and copy-consistency tests. Inspect whether the persisted scorer version needs advancing with changed comparison semantics; include the decision in deployment notes. Deploy both active scorer copies before structured writes/backfill. Do not invoke historical one-off admin matching functions.

The columns and city-search RPC already exist; a schema expansion or city database rebuild is unnecessary. Populating cities without fixing comparisons would introduce false matches across states.

## Task 3: Recover from render and startup failures

**Files:**
- Create `src/components/AppErrorBoundary.tsx` and its test.
- Create `src/bootstrap.tsx`, `src/startup.ts`, `src/config/publicEnv.ts`, and startup/config tests.
- Modify `src/main.tsx`, `index.html`, and `vite.config.ts`.
- Preserve the generated Supabase client if preflight validation and deferred loading make editing it unnecessary.

**Interfaces:** `mountApp(root: HTMLElement): void` is exported by bootstrap and imports React, App, and the boundary. `validatePublicEnv(env: Record<string, unknown>): void` checks the URL and nonblank publishable key and throws messages containing variable names, never values. `startApp(root: HTMLElement, load: () => Promise<{mountApp(root: HTMLElement): void}>): Promise<void>` validates config, awaits the loader, mounts, and catches startup failures with a plain DOM fallback.

- [ ] Add a render-crash test using `function Broken(): never { throw new Error("test crash"); }`; render it under the boundary and assert a visible recovery message and Reload control instead of a blank root.
- [ ] Add startup tests for missing URL, missing key, malformed URL, rejected module import, synchronous mount failure, and success. Assert the app loader is never called when configuration is invalid.
- [ ] Move React/App imports into bootstrap. Keep main dependency-light and call:

```ts
void startApp(document.getElementById("root")!, () => import("./bootstrap"));
```

- [ ] Implement a React 18 class boundary with `getDerivedStateFromError`, safe error reporting in `componentDidCatch`, and a fallback using ordinary HTML controls. Place it above App, auth, and router providers. A synchronous try/catch around `root.render()` does not replace this boundary.
- [ ] Render startup failure using DOM APIs/textContent, independent of React and the failed providers. Provide Reload and a safe home link. Seed `index.html` with a minimal loading/recovery message and a noscript message so failure to fetch the entry module does not leave an empty root.
- [ ] Use the same public-env validator in Vite's build path, loading the selected mode with process-env precedence. Fail invalid builds with variable names only. Validate missing configuration in an isolated environment/fixture, without deleting the real `.env`.
- [ ] Verify provider render failure and rejected lazy-route import under the boundary; verify missing configuration and module-evaluation failure under startup recovery. Exercise the production bundle in a browser, including reload recovery after correcting the failure. Preserve the existing login session.

React boundaries catch descendant render/lifecycle failures, not arbitrary event-handler or asynchronous callback errors. Failed actions still need their own error handling. Reference: [React error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary). Vite public environment variables are embedded at build time; runtime messaging cannot repair a misconfigured bundle. Reference: [Vite env and modes](https://vite.dev/guide/env-and-mode).

## Task 4: Targeted data repair and rollout verification

- [ ] Re-read production immediately before repair; the seven-profile snapshot is not a permanent inventory. Create a restricted snapshot of only changed IDs/fields and original values for rollback, without committing private data.
- [ ] Recompute completion with the tested shared policy, producing a dry-run old/new diff. Identify profiles affected specifically by unreachable questions. Do not blindly update every 80 to 100 or sweep unrelated scoring changes into this repair.
- [ ] Resolve legacy location against city plus state abbreviation/full state name. Produce a dry-run diff; only populate a unique match where the structured fields are still empty. Preserve custom/unmatched values, and leave blanks blank. Current snapshot predicts five unambiguous candidates.
- [ ] Establish access to the correct project's SQL and function deployment before deployment. Inspect live triggers and transaction behavior. Source migrations show profile updates change `updated_at`, which scoring uses for recency; explicitly account for this before a cosmetic backfill rather than treating it as new user activity or silently disabling triggers.
- [ ] Apply only reviewed candidates with concurrency guards against the previously read values; skip/review a row if the user edited it since the snapshot. Use a transaction for SQL repair and retain a guarded rollback diff. An update count differing from the reviewed candidate count requires reconciliation.
- [ ] Re-read affected profiles to verify score and structured location. Deploy matching compatibility before location writes, then the UI changes, then repair old data. Recompute only impacted match outputs if needed under the normal matching path; preserve directional match state and dismissals.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`; run the repository's Node Concierge suite if matching changes. Record any tool/runtime limits rather than presenting unrun checks as passed.
- [ ] Verify real signup/edit round trips and controlled crash recovery in a nonproduction test account/environment. Report shipped versions, repaired row counts, and remaining unmatched locations.

## Review of scope

All three requested defects have a reproducible cause and a bounded implementation path. Connected editor/scorer changes are included because otherwise the immediate fixes leave stale state or introduce incorrect location comparisons. The remaining operational uncertainty is access to SQL/Edge Function deployment for the configured project; no unresolved product choice prevents preparing and testing the application changes.
