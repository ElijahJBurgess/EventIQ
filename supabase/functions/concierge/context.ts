import {
  computeLiveMatch,
  LIVE_COMPARISON_DISCLAIMER,
  resolveNamedCandidateId,
  SCORER_PROFILE_COLUMNS,
  toScorerProfile,
  type CheckedInName,
} from "./liveComparison.ts";

export type ConciergeContextStatus = "ready" | "profile_completion_required" | "no_matches" | "no_people_checked_in";

export interface ProfileRow {
  id: string;
  full_name?: string | null;
  title?: string | null;
  company?: string | null;
  role_type?: string | null;
  secondary_role_types?: string[] | null;
  matching_goal?: string | null;
  primary_goal?: string | null;
  secondary_goals?: string[] | null;
  desired_outcomes?: string[] | null;
  needs?: string[] | null;
  offers?: string[] | null;
  areas_of_expertise?: string[] | null;
  interests?: string[] | null;
  communities?: string[] | null;
  who_to_meet?: string[] | null;
  connection_preference?: string[] | null;
  industry_focus?: string[] | null;
  location?: string | null;
}

/**
 * A raw DB row carrying every column calculateMatchScore consumes. Fetched for
 * the current user (own profile, RLS-OK) and for a live-comparison candidate
 * (service role). `profileData()` still only reads the ProfileRow subset.
 */
export type ScoringProfileRow = ProfileRow & Record<string, unknown>;

export interface EventRow {
  id: string;
  name: string;
  date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  venue?: string | null;
}

export interface MatchRow {
  id: string;
  event_id: string | null;
  user_a_id: string | null;
  user_b_id: string | null;
  a_to_b_score: number | null;
  b_to_a_score: number | null;
  a_to_b_confidence: number | null;
  b_to_a_confidence: number | null;
  reciprocity_label?: string | null;
  match_reason?: string | null;
  ai_explanation?: string | null;
  score_breakdown?: unknown;
  match_evidence?: unknown;
  match_details?: unknown;
  shared_goals?: string[] | null;
  shared_interests?: string[] | null;
  shared_industries?: string[] | null;
  shared_communities?: string[] | null;
}

export interface MessageFactRow {
  id: string;
  match_id: string | null;
  event_id: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  message_type: string | null;
  created_at: string | null;
}

export interface MeetingRow {
  id: string;
  match_id: string;
  event_id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  requested_at: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location_note: string | null;
  completed_at: string | null;
}

export interface ConciergeContextSource {
  getCurrentProfile(userId: string): Promise<ProfileRow | null>;
  getEvent(eventId: string): Promise<EventRow | null>;
  getMatches(userId: string, eventId: string): Promise<MatchRow[]>;
  getCheckedInProfileIds(eventId: string): Promise<string[]>;
  getProfiles(profileIds: string[]): Promise<ProfileRow[]>;
  getMessageFacts(userId: string, eventId: string, matchIds: string[]): Promise<MessageFactRow[]>;
  getMeetings(userId: string, eventId: string, matchIds: string[]): Promise<MeetingRow[]>;
}

interface UserAuthoredProfileData {
  name: string | null;
  title: string | null;
  company: string | null;
  roleType: string | null;
  secondaryRoleTypes: string[];
  goals: {
    matchingGoal: string | null;
    primaryGoal: string | null;
    secondaryGoals: string[];
    desiredOutcomes: string[];
  };
  needs: string[];
  offers: string[];
  expertise: string[];
  interests: string[];
  communities: string[];
  location: string | null;
  matchingPreferences: {
    whoToMeet: string[];
    connectionPreference: string[];
    industryFocus: string[];
  };
}

export interface ConciergeRelationshipFacts {
  displayStatus: string | null;
  connectionRequestState: "none" | "sent" | "received" | "reciprocal";
  hasConversation: boolean;
  hasReciprocalConversation: boolean;
  currentMeetingStatus: string | null;
  isInMotion: boolean;
  hasCompletedMeeting: boolean;
}

export interface ConciergeMatchContext {
  trusted: {
    matchId: string;
    profileId: string;
    eventId: string;
    persistedScore: number;
    persistedConfidence: number;
  };
  userAuthoredProfileData: UserAuthoredProfileData;
  persistedMatchEvidence: {
    reason: string | null;
    aiExplanation: string | null;
    scoreBreakdown: unknown;
    matchEvidence: unknown;
    reciprocityLabel: string | null;
    matchDetails: unknown;
    sharedGoals: string[];
    sharedInterests: string[];
    sharedIndustries: string[];
    sharedCommunities: string[];
  };
  relationship: ConciergeRelationshipFacts;
}

/**
 * An on-the-spot, non-persisted comparison for someone the user has NOT matched
 * with. Same score/confidence/reasons shape as a real match, but flagged so the
 * model frames it honestly as "not an official match yet".
 */
export interface ConciergeLiveComparison {
  isLiveComputed: true;
  trusted: {
    profileId: string;
    eventId: string;
    /** Viewer-directional: current user -> candidate. Not persisted anywhere. */
    computedScore: number;
    computedConfidence: number;
  };
  candidateProfileData: UserAuthoredProfileData;
  liveMatchEvidence: {
    reasons: string[];
    reciprocityLabel: string;
    reverseScore: number;
    reverseConfidence: number;
    scoreVersion: string;
  };
  disclaimer: string;
}

export interface ConciergeMeetingContext {
  trusted: {
    meetingId: string;
    matchId: string;
    eventId: string;
    otherProfileId: string;
  };
  otherPersonName: string | null;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
}

export interface ConciergeContext {
  status: ConciergeContextStatus;
  trusted: {
    authenticatedUserId: string;
    event: {
      id: string;
      date: string | null;
      endDate: string | null;
      startTime: string | null;
      endTime: string | null;
      venue: string | null;
      location: string | null;
    };
  };
  roomDisplayData: { name: string };
  currentUser: null | {
    trusted: { profileId: string };
    userAuthoredProfileData: UserAuthoredProfileData;
  };
  checkedInMatches: ConciergeMatchContext[];
  meetings: ConciergeMeetingContext[];
  /** At most one live "how would we score" comparison for an unmatched person the question named. */
  liveComparison: ConciergeLiveComparison | null;
}

export interface ConciergeLiveCandidateSource {
  /** Every checked-in attendee's id + name at the event (for name resolution). */
  getCheckedInNames(eventId: string): Promise<CheckedInName[]>;
  /** Full scoring-column row for one profile id, or null. */
  getScoringProfile(profileId: string): Promise<ScoringProfileRow | null>;
}

const RELEVANT_MEETING_STATUSES = new Set(["requested", "accepted", "scheduled", "completed", "declined", "cancelled"]);
const ACTIVE_MEETING_STATUSES = new Set(["requested", "accepted", "scheduled"]);

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function profileData(profile: ProfileRow): UserAuthoredProfileData {
  return {
    name: profile.full_name ?? null,
    title: profile.title ?? null,
    company: profile.company ?? null,
    roleType: profile.role_type ?? null,
    secondaryRoleTypes: profile.secondary_role_types ?? [],
    goals: {
      matchingGoal: profile.matching_goal ?? null,
      primaryGoal: profile.primary_goal ?? null,
      secondaryGoals: profile.secondary_goals ?? [],
      desiredOutcomes: profile.desired_outcomes ?? [],
    },
    needs: profile.needs ?? [],
    offers: profile.offers ?? [],
    expertise: profile.areas_of_expertise ?? [],
    interests: profile.interests ?? [],
    communities: profile.communities ?? [],
    // attendee_profiles (the view used for matched candidates) only exposes
    // the free-text `location` column, not location_city/location_state_code
    // -- using the same field for both the current user and candidates keeps
    // this consistent rather than richer for one side and missing for the other.
    location: profile.location ?? null,
    matchingPreferences: {
      whoToMeet: profile.who_to_meet ?? [],
      connectionPreference: profile.connection_preference ?? [],
      industryFocus: profile.industry_focus ?? [],
    },
  };
}

function baseContext(userId: string, event: EventRow, status: ConciergeContextStatus): ConciergeContext {
  return {
    status,
    trusted: {
      authenticatedUserId: userId,
      event: {
        id: event.id,
        date: event.date ?? null,
        endDate: event.end_date ?? null,
        startTime: event.start_time ?? null,
        endTime: event.end_time ?? null,
        venue: event.venue ?? null,
        location: event.location ?? null,
      },
    },
    roomDisplayData: { name: event.name },
    currentUser: null,
    checkedInMatches: [],
    meetings: [],
    liveComparison: null,
  };
}

/**
 * Best-effort live comparison for an unmatched person the question names. Never
 * throws -- returns null on any problem (no name resolved, lookup failed, etc.).
 * Read-only: no AI explanation, no DB write.
 */
async function tryLiveComparison(
  liveCandidateSource: ConciergeLiveCandidateSource,
  question: string,
  eventId: string,
  currentProfileRow: ScoringProfileRow,
  alreadyMatchedProfileIds: ReadonlySet<string>,
): Promise<ConciergeLiveComparison | null> {
  try {
    const checkedInNames = await liveCandidateSource.getCheckedInNames(eventId);
    const unmatchedIds = new Set(
      checkedInNames
        .map((person) => person.id)
        .filter((id) => id !== currentProfileRow.id && !alreadyMatchedProfileIds.has(id)),
    );
    if (unmatchedIds.size === 0) return null;

    const candidateId = resolveNamedCandidateId(question, checkedInNames, unmatchedIds);
    if (!candidateId) return null;

    const candidateRow = await liveCandidateSource.getScoringProfile(candidateId);
    if (!candidateRow) return null;

    const live = computeLiveMatch(
      toScorerProfile(currentProfileRow),
      toScorerProfile(candidateRow),
    );
    return {
      isLiveComputed: true,
      trusted: {
        profileId: candidateId,
        eventId,
        computedScore: live.computedScore,
        computedConfidence: live.computedConfidence,
      },
      candidateProfileData: profileData(candidateRow),
      liveMatchEvidence: {
        reasons: live.reasons,
        reciprocityLabel: live.reciprocityLabel,
        reverseScore: live.reverseScore,
        reverseConfidence: live.reverseConfidence,
        scoreVersion: live.scoreVersion,
      },
      disclaimer: LIVE_COMPARISON_DISCLAIMER,
    };
  } catch {
    return null;
  }
}

function isExactPair(userId: string, otherId: string, first: string | null, second: string | null) {
  return (first === userId && second === otherId) || (first === otherId && second === userId);
}

function viewerReciprocityLabel(label: string | null | undefined, viewerIsA: boolean): string | null {
  if (!label || viewerIsA) return label ?? null;
  if (label === "They Can Help You") return "You Can Help Them";
  if (label === "You Can Help Them") return "They Can Help You";
  return label;
}

function deriveRelationship(
  userId: string,
  messages: MessageFactRow[],
  meetings: MeetingRow[],
): ConciergeRelationshipFacts {
  const orderedMessages = [...messages].sort(
    (left, right) => timestamp(right.created_at) - timestamp(left.created_at) || right.id.localeCompare(left.id),
  );
  const orderedMeetings = meetings
    .filter((meeting) => RELEVANT_MEETING_STATUSES.has(meeting.status))
    .sort((left, right) => timestamp(right.requested_at) - timestamp(left.requested_at) || right.id.localeCompare(left.id));
  const latestMessage = orderedMessages[0];
  const latestMeeting = orderedMeetings[0];
  const senders = new Set(orderedMessages.map((message) => message.sender_id).filter(Boolean));
  const reciprocal = senders.has(userId) && [...senders].some((sender) => sender !== userId);
  const request = orderedMessages.find((message) => message.message_type === "connect_request");
  const connectionRequestState = reciprocal
    ? "reciprocal"
    : request?.sender_id === userId
      ? "sent"
      : request
        ? "received"
        : "none";
  const hasCompletedMeeting = orderedMeetings.some((meeting) => meeting.status === "completed");

  if (latestMeeting && ACTIVE_MEETING_STATUSES.has(latestMeeting.status)) {
    const labels: Record<string, string> = {
      requested: "Meeting requested",
      accepted: "Planning a meeting",
      scheduled: "Meeting confirmed",
    };
    return {
      displayStatus: labels[latestMeeting.status],
      connectionRequestState,
      hasConversation: orderedMessages.length > 0,
      hasReciprocalConversation: reciprocal,
      currentMeetingStatus: latestMeeting.status,
      isInMotion: true,
      hasCompletedMeeting,
    };
  }

  if (latestMeeting?.status === "completed") {
    const completedAt = timestamp(latestMeeting.completed_at ?? latestMeeting.requested_at);
    if (!latestMessage || timestamp(latestMessage.created_at) <= completedAt) {
      return {
        displayStatus: "Meeting completed",
        connectionRequestState,
        hasConversation: orderedMessages.length > 0,
        hasReciprocalConversation: reciprocal,
        currentMeetingStatus: latestMeeting.status,
        isInMotion: false,
        hasCompletedMeeting,
      };
    }
  }

  if (latestMeeting && (latestMeeting.status === "declined" || latestMeeting.status === "cancelled")) {
    if (!latestMessage || timestamp(latestMessage.created_at) <= timestamp(latestMeeting.requested_at)) {
      return {
        displayStatus: latestMeeting.status === "declined" ? "Meeting declined" : "Meeting cancelled",
        connectionRequestState,
        hasConversation: orderedMessages.length > 0,
        hasReciprocalConversation: reciprocal,
        currentMeetingStatus: latestMeeting.status,
        isInMotion: false,
        hasCompletedMeeting,
      };
    }
  }

  const displayStatus = reciprocal
    ? "Conversation started"
    : request?.sender_id === userId
      ? "Connection request sent"
      : request
        ? "Connection request received"
        : orderedMessages.length > 0
          ? "Conversation started"
          : null;
  return {
    displayStatus,
    connectionRequestState,
    hasConversation: orderedMessages.length > 0,
    hasReciprocalConversation: reciprocal,
    currentMeetingStatus: latestMeeting?.status ?? null,
    isInMotion: orderedMessages.length > 0,
    hasCompletedMeeting,
  };
}

export async function buildConciergeContext(
  source: ConciergeContextSource,
  userId: string,
  eventId: string,
  question = "",
  liveCandidateSource?: ConciergeLiveCandidateSource,
): Promise<ConciergeContext> {
  const [currentProfile, event] = await Promise.all([
    source.getCurrentProfile(userId),
    source.getEvent(eventId),
  ]);
  if (!event || event.id !== eventId) throw new Error("Authorized event context is unavailable");

  if (!currentProfile || currentProfile.id !== userId) {
    return baseContext(userId, event, "profile_completion_required");
  }

  const context = baseContext(userId, event, "ready");
  context.currentUser = {
    trusted: { profileId: currentProfile.id },
    userAuthoredProfileData: profileData(currentProfile),
  };

  const [rawMatches, checkedInProfileIds] = await Promise.all([
    source.getMatches(userId, eventId),
    source.getCheckedInProfileIds(eventId),
  ]);
  const authorizedMatches = rawMatches.filter((match) => (
    match.event_id === eventId
    && (match.user_a_id === userId || match.user_b_id === userId)
  ));

  // A live comparison is about someone the user has NO match row with, so exclude
  // every counterpart across all of the user's match rows for this event.
  const alreadyMatchedProfileIds = new Set(
    authorizedMatches
      .map((match) => (match.user_a_id === userId ? match.user_b_id : match.user_a_id))
      .filter((id): id is string => Boolean(id)),
  );
  if (liveCandidateSource && question.trim()) {
    context.liveComparison = await tryLiveComparison(
      liveCandidateSource,
      question,
      eventId,
      currentProfile as ScoringProfileRow,
      alreadyMatchedProfileIds,
    );
  }

  if (authorizedMatches.length === 0) {
    // Still answerable if we found a live comparison for a named unmatched person.
    if (!context.liveComparison) context.status = "no_matches";
    return context;
  }

  const checkedIn = new Set(checkedInProfileIds.filter((profileId) => profileId !== userId));
  const eligibleMatches = authorizedMatches
    .map((match) => {
      const viewerIsA = match.user_a_id === userId;
      const score = viewerIsA ? match.a_to_b_score : match.b_to_a_score;
      const confidence = viewerIsA ? match.a_to_b_confidence : match.b_to_a_confidence;
      const breakdown = match.score_breakdown && typeof match.score_breakdown === "object"
        ? (match.score_breakdown as Record<string, unknown>)[viewerIsA ? "aToB" : "bToA"] ?? null
        : null;
      const evidence = match.match_evidence && typeof match.match_evidence === "object"
        ? (match.match_evidence as Record<string, unknown>)[viewerIsA ? "aToB" : "bToA"] ?? null
        : null;
      return {
        match,
        otherId: viewerIsA ? match.user_b_id : match.user_a_id,
        score,
        confidence,
        breakdown,
        evidence,
        reciprocityLabel: viewerReciprocityLabel(match.reciprocity_label, viewerIsA),
      };
    })
    .filter((entry): entry is typeof entry & { otherId: string; score: number; confidence: number } => Boolean(
      entry.otherId
      && checkedIn.has(entry.otherId)
      && entry.score !== null
      && entry.score >= 60
      && entry.confidence !== null
      && entry.confidence >= 70
    ))
    .sort((left, right) => (
      right.score - left.score
      || left.match.id.localeCompare(right.match.id)
    ))
    .slice(0, 10);
  if (eligibleMatches.length === 0) {
    if (!context.liveComparison) context.status = "no_people_checked_in";
    return context;
  }

  const allowedProfileIds = eligibleMatches.map((entry) => entry.otherId);
  const allowedMatchIds = eligibleMatches.map((entry) => entry.match.id);
  const [profiles, rawMessages, rawMeetings] = await Promise.all([
    source.getProfiles(allowedProfileIds),
    source.getMessageFacts(userId, eventId, allowedMatchIds),
    source.getMeetings(userId, eventId, allowedMatchIds),
  ]);
  const allowedProfileIdSet = new Set(allowedProfileIds);
  const profileById = new Map(
    profiles
      .filter((profile) => allowedProfileIdSet.has(profile.id))
      .map((profile) => [profile.id, profile]),
  );
  const otherIdByMatch = new Map(eligibleMatches.map((entry) => [entry.match.id, entry.otherId]));

  const messageFacts = rawMessages.filter((message) => {
    const otherId = message.match_id ? otherIdByMatch.get(message.match_id) : undefined;
    return Boolean(
      otherId
      && message.event_id === eventId
      && isExactPair(userId, otherId, message.sender_id, message.recipient_id),
    );
  });
  const meetingFacts = rawMeetings.filter((meeting) => {
    const otherId = otherIdByMatch.get(meeting.match_id);
    return Boolean(
      otherId
      && meeting.event_id === eventId
      && isExactPair(userId, otherId, meeting.requester_id, meeting.recipient_id),
    );
  });

  context.checkedInMatches = eligibleMatches.flatMap(({ match, otherId, score, confidence, breakdown, evidence, reciprocityLabel }) => {
    const profile = profileById.get(otherId);
    if (!profile) return [];
    const matchMessages = messageFacts.filter((message) => message.match_id === match.id);
    const matchMeetings = meetingFacts.filter((meeting) => meeting.match_id === match.id);
    return [{
      trusted: {
        matchId: match.id,
        profileId: otherId,
        eventId,
        persistedScore: score,
        persistedConfidence: confidence,
      },
      userAuthoredProfileData: profileData(profile),
      persistedMatchEvidence: {
        reason: match.match_reason ?? null,
        aiExplanation: match.ai_explanation ?? null,
        scoreBreakdown: breakdown,
        matchEvidence: evidence,
        reciprocityLabel,
        matchDetails: match.match_details ?? null,
        sharedGoals: match.shared_goals ?? [],
        sharedInterests: match.shared_interests ?? [],
        sharedIndustries: match.shared_industries ?? [],
        sharedCommunities: match.shared_communities ?? [],
      },
      relationship: deriveRelationship(userId, matchMessages, matchMeetings),
    }];
  });

  const includedProfileIds = new Set(context.checkedInMatches.map((match) => match.trusted.profileId));
  const includedMatchIds = new Set(context.checkedInMatches.map((match) => match.trusted.matchId));
  context.meetings = meetingFacts
    .filter((meeting) => includedMatchIds.has(meeting.match_id))
    .map((meeting) => {
      const otherProfileId = meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id;
      if (!includedProfileIds.has(otherProfileId)) return null;
      return {
        trusted: {
          meetingId: meeting.id,
          matchId: meeting.match_id,
          eventId,
          otherProfileId,
        },
        otherPersonName: profileById.get(otherProfileId)?.full_name ?? null,
        status: meeting.status,
        scheduledAt: meeting.scheduled_at,
        durationMinutes: meeting.duration_minutes,
        location: meeting.location_note,
      };
    })
    .filter((meeting): meeting is ConciergeMeetingContext => meeting !== null)
    .sort((left, right) => {
      const leftTime = left.scheduledAt ? timestamp(left.scheduledAt) : Number.POSITIVE_INFINITY;
      const rightTime = right.scheduledAt ? timestamp(right.scheduledAt) : Number.POSITIVE_INFINITY;
      return leftTime - rightTime || left.trusted.meetingId.localeCompare(right.trusted.meetingId);
    });

  if (context.checkedInMatches.length === 0 && !context.liveComparison) {
    context.status = "no_people_checked_in";
  }
  return context;
}

interface QueryResult<T> {
  data: T | null;
  error: unknown | null;
}

interface QueryBuilder<T> extends PromiseLike<QueryResult<T[]>> {
  select(columns: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  or(filter: string): QueryBuilder<T>;
  in(column: string, values: string[]): QueryBuilder<T>;
  order(column: string, options: Record<string, unknown>): QueryBuilder<T>;
  maybeSingle(): Promise<QueryResult<T>>;
}

export interface ConciergeQueryClient {
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T>;
}

function unwrap<T>(result: QueryResult<T[]>, operation: string): T[] {
  if (result.error) throw new Error(`Concierge context ${operation} failed`);
  return result.data ?? [];
}

export function createSupabaseContextSource(client: ConciergeQueryClient): ConciergeContextSource {
  return {
    async getCurrentProfile(userId) {
      // The full scorer column set (own profile, RLS-OK) + title/company for
      // profileData(), so a live unmatched comparison can run calculateMatchScore.
      const result = await client.from<ScoringProfileRow>("profiles")
        .select(`${SCORER_PROFILE_COLUMNS}, title, company`)
        .eq("id", userId)
        .maybeSingle();
      if (result.error) throw new Error("Concierge context profile lookup failed");
      return result.data;
    },
    async getEvent(eventId) {
      const result = await client.from<EventRow>("events")
        .select("id,name,date,end_date,start_time,end_time,venue,location")
        .eq("id", eventId)
        .maybeSingle();
      if (result.error) throw new Error("Concierge context event lookup failed");
      return result.data;
    },
    async getMatches(userId, eventId) {
      const result = await client.from<MatchRow>("matches")
        .select("id,event_id,user_a_id,user_b_id,a_to_b_score,b_to_a_score,a_to_b_confidence,b_to_a_confidence,reciprocity_label,match_reason,ai_explanation,score_breakdown,match_evidence,match_details,shared_goals,shared_interests,shared_industries,shared_communities")
        .eq("event_id", eventId)
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
      return unwrap(result, "match lookup");
    },
    async getCheckedInProfileIds(eventId) {
      const result = await client.from<{ profile_id: string | null }>("matched_event_attendance")
        .select("profile_id")
        .eq("event_id", eventId)
        .eq("is_checked_in", true);
      return unwrap(result, "check-in lookup").map((row) => row.profile_id).filter((id): id is string => Boolean(id));
    },
    async getProfiles(profileIds) {
      if (profileIds.length === 0) return [];
      const result = await client.from<ProfileRow>("attendee_profiles")
        .select("id,full_name,title,company,role_type,secondary_role_types,matching_goal,primary_goal,secondary_goals,desired_outcomes,needs,offers,areas_of_expertise,interests,communities,who_to_meet,connection_preference,industry_focus,location")
        .in("id", profileIds);
      return unwrap(result, "matched profile lookup");
    },
    async getMessageFacts(userId, eventId, matchIds) {
      if (matchIds.length === 0) return [];
      const result = await client.from<MessageFactRow>("messages")
        .select("id,match_id,event_id,sender_id,recipient_id,message_type,created_at")
        .eq("event_id", eventId)
        .in("match_id", matchIds)
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
      return unwrap(result, "message fact lookup");
    },
    async getMeetings(userId, eventId, matchIds) {
      if (matchIds.length === 0) return [];
      const result = await client.from<MeetingRow>("meetings")
        .select("id,match_id,event_id,requester_id,recipient_id,status,requested_at,scheduled_at,duration_minutes,location_note,completed_at")
        .eq("event_id", eventId)
        .in("match_id", matchIds)
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("requested_at", { ascending: false });
      return unwrap(result, "meeting lookup");
    },
  };
}

/**
 * Backed by a SERVICE-ROLE client (not the caller's JWT): the live comparison
 * needs an unmatched attendee's profile, which the caller's RLS cannot see.
 * Scoped to attendees checked in at the same event the caller is registered for.
 */
export function createSupabaseLiveCandidateSource(serviceClient: ConciergeQueryClient): ConciergeLiveCandidateSource {
  return {
    async getCheckedInNames(eventId) {
      // Base table, NOT matched_event_attendance: that view is gated on
      // auth.uid(), which is NULL for this service-role client, so it would
      // always return nobody. Service role bypasses RLS on the base table.
      const checkins = await serviceClient.from<{ profile_id: string | null }>("event_registrations")
        .select("profile_id")
        .eq("event_id", eventId)
        .eq("status", "registered")
        .eq("is_checked_in", true);
      const ids = unwrap(checkins, "live check-in lookup")
        .map((row) => row.profile_id)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return [];
      const names = await serviceClient.from<{ id: string; full_name: string | null }>("profiles")
        .select("id,full_name")
        .in("id", ids);
      return unwrap(names, "live name lookup").map((row) => ({ id: row.id, fullName: row.full_name ?? null }));
    },
    async getScoringProfile(profileId) {
      const result = await serviceClient.from<ScoringProfileRow>("profiles")
        .select(SCORER_PROFILE_COLUMNS)
        .eq("id", profileId)
        .maybeSingle();
      if (result.error) throw new Error("Concierge context live candidate lookup failed");
      return result.data;
    },
  };
}

export function summarizeConciergeContext(context: ConciergeContext) {
  const activeStatuses = new Set(["requested", "accepted", "scheduled"]);
  return {
    status: context.status,
    authenticatedUserId: context.trusted.authenticatedUserId,
    event: {
      id: context.trusted.event.id,
      name: context.roomDisplayData.name,
    },
    checkedInMatchCount: context.checkedInMatches.length,
    conversationCount: context.checkedInMatches.filter((match) => match.relationship.hasConversation).length,
    activeMeetingCount: context.meetings.filter((meeting) => activeStatuses.has(meeting.status)).length,
    allowedMatchIds: context.checkedInMatches.map((match) => match.trusted.matchId),
    allowedProfileIds: context.checkedInMatches.map((match) => match.trusted.profileId),
    liveComparisonProfileId: context.liveComparison?.trusted.profileId ?? null,
  };
}
