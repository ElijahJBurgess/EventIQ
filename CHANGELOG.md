# Changelog

Full commit history organized by build phase. Commits are listed newest-first within each phase.

All commit hashes reference the `main` branch of `https://github.com/ElijahJBurgess/EventIQ`.

---

## Phase 4 — Security Audit & Production Hardening
*September 2026 — post-Render ATL*

| Hash | Commit |
|---|---|
| `b211e34` | Fix admin-created events missing `organizer_id`; promote Chanise to organizer on all events; clean up QA test data |
| `d363fd1` | Remove 60/70 score floor from Matches tab so it matches Home |
| `b3a5a3f` | Mandatory LinkedIn + photo, role-questions copy/skip fix, connection archive |
| `819a19d` | Owner dashboard: move create-event into a dedicated Events tab + add management |
| `e64af81` | Self-serve organizer: edit, hide/unhide, delete events |
| `a617291` | Home always shows the most-recently-joined event + Browse Events empty state |
| `29e0fbf` | Mandatory event pick at signup + copy fixes |
| `9cbb9ea` | Revert UI copy: "People" → "Matches", "Rooms" → "Events" |
| `2afe15f` | Joining a room checks the user in immediately — no separate step |
| `a1b7969` | Concierge: platform-wide, not scoped to one event/room |
| `0c8b8a1` | Self-serve room creation for organizer-flagged accounts |
| `cc9942c` | Concierge: live "how would we score" comparison for unmatched people |
| `b49705a` | `match-engine`: canonical pair ordering + atomic upsert (race fix) |
| `ae3ae90` | Full Profile View: editable "Make the Intro" via shared `ConnectComposer` |
| `b27b1cd` | Onboarding: make the eight optional multi-selects required |
| `b8c6e09` | Owner-only room creation: `admin-auth` create-event action + Create Room form |
| `d4931b6` | Home: "Your company is in the room" banner + personalized top-match heading |
| `e61a02d` | Rooms: fix room-card subtitle separators and date format |
| `23ddf93` | People card: make the person's name open their full profile |
| `361b670` | People card: move "See Why" reason into a modal, not inline |
| `a61e73f` | Tune People card layout to match the mockup |
| `3299944` | Redesign the People match card on the OFFRIP primitives |
| `56ae527` | Edit profile: enforce signup's required pick-one fields at save |
| `eabc588` | Home stats: fall back to most recent checked-in event when none is live |
| `61e6146` | Rename "Matches" tab and heading to "People" |
| `a89b76d` | Add README and `.env.example` for handoff |
| `f1739a9` | Fix S8: profile edit fails when a "pick one" field is blank |
| `805eaf7` | Group 1 security fix pass — audit findings S1, S2, S5, S4 (CORS) |
| `6d337f8` | Decommission `admin-gen-link`: neutralized to a 410 stub |
| `880c53c` | V1 audit: Section 5 (compliance) + finalize — audit complete |
| `d913c53` | V1 audit: Section 4 (schema health) complete |
| `b0717e5` | V1 audit: Section 3 (security) complete |
| `bd0969e` | V1 audit: Section 2 (edge functions) complete |
| `4626086` | V1 audit: Section 1 (user-facing flows) complete |
| `6106ee6` | Start V1 readiness audit doc: application map + recon |

---

## Phase 3 — Enterprise Dashboard & Full Product Polish
*Late August – September 2026*

| Hash | Commit |
|---|---|
| `8cc4eb1` | Add `admin-run-matching`: one-off operator utility for v2.1 match backfill |
| `70eba1f` | Add self-serve account deletion (App Store / privacy compliance) |
| `0df223e` | Build the Enterprise dashboard: six data-wired tabs at `/v2/admin` |
| `495c748` | Fix Concierge event-venue location gap from full platform walkthrough |
| `bdcf770` | Add explicit connection status system: request/accept/decline, gated messaging & scheduling, functional Connections tab, and post-connection self-report |
| `f90308e` | Polish onboarding/matches copy, fix Concierge location gap, correct rubric V2 timing scoring |
| `1ce5cd9` | Fix signup onboarding routing |
| `443e8e4` | Implement directional matching rubric V2 |
| `11eaccf` | Fix onboarding entry and event joining |
| `618fc10` | Fix idempotent event joining |
| `7db301a` | Polish and harden OFFRIP V1 |
| `584ca30` | Harden OFFRIP V1 security |
| `36dd040` | Secure match engine authorization |
| `56274db` | Secure attendee profile access |
| `b4697e9` | Complete OFFRIP Concierge V1 |
| `2a99580` | Complete V1 notifications and messaging UX |
| `9ae921c` | Optimize V1 initial bundle with route lazy loading |
| `751a945` | V1 core flow, design migration, rooms and connections |

---

## Phase 2 — Full Profile View, AI Matching V2 & OFFRIP Design Migration
*Mid-August 2026*

| Hash | Commit |
|---|---|
| `b50f562` | Fix role-pairing sentence to use viewer-first orientation |
| `a26d272` | Wire real entry points into Full Profile View from Matches and Home |
| `c38c75e` | Extract shared connect-request flow; wire "Make the Intro" |
| `8d2d2e4` | Add Full Profile View UI component |
| `27331c3` | Add rule-based template layer for the 4 Full Profile View sections |
| `e2fb414` | Add data-fetch layer for Full Profile View |
| `605c89e` | Persist structured `match_details` from the match-engine scoring loop |
| `9b78759` | Add structured match-explanation extraction functions to the scorer |
| `f68f08e` | Add `match_details` column for structured match explanations |
| `6be9bfb` | Complete weighted multi-identity matching engine |
| `6478c16` | Rebuild onboarding and add full profile editing |
| `02c5f50` | Add questionnaire and matching data foundations |
| `6168e6c` | OFFRIP reskin: design tokens, reusable components, Home page restyle + background fix |
| `12b5497` | Add complete Home tab — personal dashboard with live stats, event context, schedule, top matches, and connection activity |
| `b42d220` | Complete Step 10 organizer dashboard — full navigation tab, password protection with 72-hour session expiration |
| `2ba8c58` | Complete Step 8 — full meeting scheduling system with request/accept/decline/schedule/calendar export/complete lifecycle |
| `d0ad5c4` | Add real event check-in status — check-in button, timestamp tracking, date-restricted availability |
| `b110afe` | Multi-event support complete — profile setup, event selection, matching, messages, and event grouping all event-aware |
| `c01cfcb` | Add editable message composer and duplicate request protection |
| `0345610` | Fix Vercel 404 on direct navigation — add SPA rewrite config |
| `e3560c8` | Fix profile completion score bug — single source of truth in `ProfileSetup`, removed conflicting dashboard formula |

---

## Phase 1 — Core Build (Weeks 2–3)
*July – August 2026*

| Hash | Commit |
|---|---|
| `ae5c664` | Messaging system complete — conversation list, message threads, connect flow, security fix |
| `1ac7efc` | Week 3 complete — real matches UI, auto trigger, scoring engine live |
| `3be50c8` | Week 3 Day 2 — match engine Edge Function built and deployed |
| `2c87bda` | Week 3 Day 2 — scoring engine built and tested, seed profiles backfilled with industry focus |
| `d97e6d6` | Week 3 Day 1 — Render ATL event created, role type bug fixed, 40 seed profiles seeded |
| `eb9630e` | Week 2 complete — full 4-page profile setup flow verified and tested |
| `44eba94` | Merge branch `main` of `https://github.com/ElijahJBurgess/EventIQ` |
| `7f3c6ab` | Week 2 checkpoint — Pages 1 and 2 complete |

---

## Phase 0 — Foundation
*Late June – early July 2026*

| Hash | Commit |
|---|---|
| `a4f5f06` | Initial commit — project scaffold, V1 Lovable export, Supabase schema from original build |

---

## Unmerged Branches

| Branch | Last known work |
|---|---|
| `codex/concierge-v1-filter-and-terms-cleanup` | Concierge filter improvements and terms copy cleanup |
| `codex/profile-integrity-and-crash-recovery` | Profile integrity checks and crash recovery handling |
