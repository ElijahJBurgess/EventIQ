# OFFRIP Matching Logic and Scoring Rubric (Final)

## Objective
Update the matching engine so scores reflect how valuable a connection is to each user individually. This spec covers backend scoring and match-explanation logic only. Do not change the existing questionnaire or onboarding flow — it already collects the required data.

## Primary Change: Directional Scoring
A connection may be more valuable to one person than the other. Each matched pair receives two separate scores:

- **A_TO_B_SCORE** = How valuable Person B is to Person A
- **B_TO_A_SCORE** = How valuable Person A is to Person B

Person A sees `A_TO_B_SCORE`. Person B sees `B_TO_A_SCORE`. Do not combine these into one symmetric percentage. Do not use a harmonic mean. Reciprocity is a separate label, not a requirement for a strong score.

## 1. Score Formula

```
DIRECTIONAL_MATCH_SCORE =
    35% Goal-to-Value Fit
  + 20% Target-Person Fit
  + 15% Need-to-Offer Fit
  + 10% Expertise Fit
  + 10% Opportunity Compatibility
  +  5% Timing and Connection Fit
  +  5% Context Fit
```

The highest-weighted categories represent whether the candidate can help the viewer accomplish what they came to the event to do.

## 2. Goal-to-Value Fit — 35%

Compare the viewer's primary and secondary goals against the candidate's offers, expertise, professional identity, open opportunities, and applicable conditional answers.

| Match strength | Score |
|---|---|
| Direct fulfillment of primary goal | 100 |
| Strong complementary primary goal | 90 |
| Direct fulfillment of secondary goal | 80 |
| Strong adjacent support | 65 |
| Broadly relevant connection | 40 |
| No identifiable goal connection | 0 |

```
GOAL_TO_VALUE_FIT = 70% strongest primary-goal connection + 30% strongest secondary-goal connection
```
If no secondary goal was selected, use the primary-goal score alone.

Examples of direct/complementary relationships:
- Meet Investors ↔ Investor, Investment Capital, Investor Introductions, or actively investing
- Find Business Partners ↔ Partnership Opportunities, Business Development Expertise, or Brand/Partnership Leader
- Meet Potential Customers ↔ candidate fits ideal customer profile
- Explore Career Opportunities ↔ Recruiter, Hiring Manager, Job Referrals, or active hiring opportunity
- Meet Brand Partners ↔ Brand/Partnership Leader or Brand Opportunities
- Find Sponsorship Opportunities ↔ Sponsorship Opportunities
- Learn From Experts ↔ candidate offers the requested expertise
- Build Community ↔ Community Builder, Community Connections, or Community Partnerships
- Explore Investment Opportunities ↔ Founder actively raising
- Find Talent ↔ candidate actively exploring a relevant role
- Meet Collaborators ↔ product/content/community collaboration
- Find a Mentor ↔ Mentorship or Mentor Others

Shared goals alone must not automatically produce a high score — the engine must determine whether the candidate can actually help advance the viewer's goal.

## 3. Target-Person Fit — 20%

Compare the viewer's "Who are you most interested in meeting?" selections against the candidate's primary/secondary professional identity, function, seniority, industry, and location (when requested).

| Match strength | Score |
|---|---|
| Exact requested identity/person type | 100 |
| Exact requested function or career level | 90 |
| Closely related identity/person type | 75 |
| Matches requested industry/location preference | 60 |
| Broad professional relevance | 40 |
| No requested-person alignment | 0 |

Examples:
- "Investors" ↔ candidate is an Investor: 100
- "Brand Leaders" ↔ candidate is a Brand/Partnership Leader: 100
- "Professionals in My Function" ↔ exact function match: 90
- "Experienced Industry Leaders" ↔ relevant industry, Director-level or above: 90
- "People Based in My City" ↔ exact structured city match: 100

Do not award significant points solely because two users share the same role. Founder-to-founder, investor-to-investor, or professional-to-professional matches require another meaningful connection to score well.

## 4. Need-to-Offer Fit — 15%

Compare each viewer need against the candidate's offers, using approved backend need/offer ID mappings.

| Match strength | Credit |
|---|---|
| Exact approved mapping | 100 |
| Strong conceptual mapping | 80 |
| Useful adjacent mapping | 60 |
| No approved relationship | 0 |

```
NEED_TO_OFFER_FIT = sum(best candidate-offer credit for each viewer need) ÷ number of viewer needs
```

This must be directional. One-way value receives full credit and is not reduced because the reverse direction is weaker. Remove any harmonic-mean requirement from this component.

Example:
- Viewer needs: Building Partnerships, Finding Customers
- Candidate offers: Partnership Opportunities, Sales/Business Development Expertise
- Building Partnerships → Partnership Opportunities = 100
- Finding Customers → Business Development Expertise = 80
- NEED_TO_OFFER_FIT = 90

## 5. Expertise Fit — 10%

Replace any existing shared-expertise calculation. Compare:
- **Viewer:** expertise they are hoping to find
- **Candidate:** what people can come to them for

| Match strength | Score |
|---|---|
| Two or more exact expertise matches | 100 |
| One exact expertise match | 90 |
| Strong conceptual expertise match | 75 |
| Useful adjacent expertise match | 50 |
| No expertise connection | 0 |

Shared/overlapping expertise may support conversation starters or tie-breaking, but must not drive this score unless the viewer is specifically seeking peers with that expertise.

## 6. Opportunity Compatibility — 10%

Apply only when relevant conditional data exists. Applicable pairings:
- Founder seeking capital ↔ investor deploying capital (appropriate stage/sector/check size)
- Career seeker ↔ recruiter/hiring manager (appropriate function/level/arrangement)
- Creator seeking brand partnerships ↔ brand/partnership leader (appropriate format)
- Consultant accepting clients ↔ candidate fitting ideal-client profile
- Founder seeking customers ↔ candidate representing a relevant customer profile

| Match strength | Score |
|---|---|
| Fully compatible opportunity | 100 |
| Compatible with minor differences | 75 |
| Potential future compatibility | 50 |
| Insufficient or nonapplicable data | **null** |
| Explicit incompatibility | 0 |

Examples of explicit incompatibility:
- Investor does not invest in the founder's stage or sector
- Recruiter is not hiring for the seeker's function or level
- Candidate explicitly selected they are not open to the relevant opportunity

Missing information must never be treated as incompatibility. Only apply a hard exclusion when structured answers confirm the opportunity cannot work.

## 7. Timing and Connection Fit — 5%

Average the viewer and candidate's opportunity timelines and connection types.

**Timeline:**
| Match strength | Score |
|---|---|
| Same or compatible timeline | 100 |
| One timing tier apart | 75 |
| Two timing tiers apart | 40 |
| Clearly incompatible timing | 0 |

**Connection type:**
| Match strength | Score |
|---|---|
| Exact overlap | 100 |
| Compatible formats | 75 |
| No overlap but no conflict | 40 |
| Explicit conflict | 0 |

Compatible format examples:
- Quick Introduction ↔ One-on-One Conversation
- Scheduled Meeting ↔ Business Opportunity
- Collaboration ↔ Ongoing Professional Relationship
- Mentorship Relationship ↔ One-on-One Conversation

## 8. Context Fit — 5%

```
CONTEXT_FIT =
    40% Industry-preference fulfillment
  + 30% Location-preference fulfillment
  + 20% Shared interests
  + 10% Shared communities
```

Interests and communities are supporting signals and tie-breakers only. Community or identity information must never be used to exclude someone from recommendations.

## 9. Missing and Nonapplicable Data

Distinguish clearly:
- **0** = evaluated and incompatible
- **null** = not applicable or unavailable
- **>0** = evaluated compatibility

If a component is genuinely not applicable, remove its weight from the denominator entirely:

```
FINAL_SCORE = sum(applicable component score × component weight) ÷ sum(applicable component weights)
```

Do not score missing optional fields as zero. Do not inflate or manually rescale scores after calculation.

The following core categories should normally always be available, since their underlying questions are required by the questionnaire:
- Goal-to-Value Fit
- Target-Person Fit
- Need-to-Offer Fit
- Expertise Fit

## 10. Reciprocity Labels — FINAL THRESHOLDS

Reciprocity is a separate relationship label. It does not control or suppress the final displayed score.

**Use the 60/60 threshold (final — chosen over the stricter 70/70 alternative to avoid under-labeling mutual value during cold start, when a small early user pool naturally produces sparser two-way scores):**

| Condition | Label |
|---|---|
| A_TO_B ≥ 60 and B_TO_A ≥ 60 | **Mutual Value** |
| A_TO_B ≥ 70 and B_TO_A < 60 | **They Can Help You** |
| B_TO_A ≥ 70 and A_TO_B < 60 | **You Can Help Them** |
| All other eligible combinations | **Potential Connection** |

A person can still be a strong recommendation when most of the immediate value is one-directional.

## 11. Match Confidence

Calculated separately from compatibility.

```
MATCH_CONFIDENCE =
    30% completion of core matching fields
  + 25% number of evaluated structured signals
  + 20% completion of applicable conditional fields
  + 15% recency of answers
  + 10% confirmation/verification of profile information
```

| Confidence band | Range |
|---|---|
| High Confidence | 85–100 |
| Medium Confidence | 70–84 |
| Low Confidence | Below 70 |

**Display threshold (beta):** show a match when `DIRECTIONAL_MATCH_SCORE >= 60 AND MATCH_CONFIDENCE >= 70`. Do not round up a weaker score to make it eligible. This threshold may be adjusted after testing against real profiles.

## 12. Match Bands

| Band | Range |
|---|---|
| Don't Leave Without Meeting | 85–100 |
| Strong Match | 70–84 |
| Worth an Introduction | 60–69 |
| Not displayed | Below 60 |

Display up to 10–20 qualified recommendations. Do not lower the threshold solely to fill the maximum count — if fewer qualified matches exist, show fewer.

## 13. Match Explanation Requirements

The match percentage, "Why This Makes Sense," "What They Can Offer You," "What You Can Offer Them," and relationship-type sections must all come from the same scoring breakdown. Only display a statement when the corresponding component actually contributed points.

Explanation priority order:
1. Primary goal fulfillment
2. Direct need-to-offer matches
3. Target-person alignment
4. Supporting/tie-breaker signals (expertise, context)

Example:
```
78% Strong Match

WHY THIS MAKES SENSE
Elijah is actively investing and can provide the investor access
you selected as one of your primary goals.

WHAT THEY CAN OFFER YOU
- Investment Capital
- Investor Introductions

WHAT YOU CAN OFFER THEM
- Business Development Expertise

RELATIONSHIP TYPE
You Can Help Each Other
```

Do not generate statements like "your goals complement each other" unless that relationship was actually recognized and scored by the goal-mapping logic.

## 14. Storage Requirements

Store the following for every match:
- `a_to_b_score`
- `b_to_a_score`
- `a_to_b_confidence`
- `b_to_a_confidence`
- `reciprocity_label`
- `score_version`
- `score_breakdown` (every component score, weight, applicable denominator, and the exact fields/mappings that contributed points)
- `match_evidence`

## 15. Acceptance Criteria

The update is complete when:
1. Two users can receive different scores for the same pairing.
2. One-way value can produce a strong recommendation.
3. Reciprocity adds a label but does not suppress the directional score.
4. Expertise sought is matched against expertise offered (not shared/overlapping expertise).
5. Shared expertise alone no longer receives full expertise weight.
6. Missing optional data is treated as null, not zero.
7. Genuine incompatibility remains zero or triggers an eligibility exclusion.
8. Match explanations only reference evidence actually used in scoring.
9. The score displayed to a user matches that user's own directional score.
10. Existing profiles can be rescored without users retaking the questionnaire.
11. Existing questionnaires and onboarding flows remain unchanged.
12. All existing matches are regenerated using a new `score_version`.
13. The revised formula is tested against real profile examples and displayed scores align with the strength described in their explanations.
