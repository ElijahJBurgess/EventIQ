// Pure aggregation for the organizer/enterprise "event-stats" payload.
// No Deno or Supabase imports here on purpose: index.ts does every fetch and
// hands the raw rows in, so this file runs under the normal Vitest suite
// (see supabase/functions/admin-auth/stats.test.ts).

export interface EventInput {
  id: string;
  name: string;
  date: string | null;
}

export interface RegistrationRow {
  profile_id: string | null;
  is_checked_in: boolean | null;
}

export interface ProfileRow {
  id: string;
  profile_completed: boolean | null;
  primary_goal: string | null;
  seniority: string | null;
  areas_of_expertise: string[] | null;
  interests: string[] | null;
  communities: string[] | null;
  role_type: string | null;
  industries: string[] | null;
  location: string | null;
}

export interface MatchRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  connection_status: string | null;
  connection_requested_by: string | null;
  connection_status_updated_at: string | null;
}

export interface MessageRow {
  match_id: string | null;
  sender_id: string | null;
  message_type: string | null;
}

export interface MeetingRow {
  match_id: string | null;
  status: string | null;
  created_at: string | null;
}

export interface FeedbackRow {
  user_id: string | null;
  overall_rating: number | null;
  matching_rating: number | null;
  networking_quality: number | null;
}

export interface SelfReportRow {
  match_id: string | null;
  user_id: string | null;
  response: string | null;
  was_valuable: boolean | null;
}

export interface BuildEventStatsInput {
  event: EventInput;
  /** Registrations already scoped to this event. */
  registrations: RegistrationRow[];
  /** Profiles for this event's registrants. */
  profiles: ProfileRow[];
  /** Exact-count query result for matches in this event. */
  matchCount: number;
  /** Exact-count query result for connect_request messages in this event. */
  connectionRequestMessageCount: number;
  /** All matches for this event. */
  matches: MatchRow[];
  /** All messages for this event. */
  messages: MessageRow[];
  /** All meetings for this event. */
  meetings: MeetingRow[];
  /** All feedback rows for this event. */
  feedback: FeedbackRow[];
  /** Self-reports scoped to this event's matches. */
  selfReports: SelfReportRow[];
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
}

export interface ConnectionsByDayPoint {
  date: string;
  connections: number;
  meetings: number;
}

export interface IntentBreakdownEntry {
  label: string;
  count: number;
  pct: number;
}

export interface AudienceSegment {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface RelationshipPair {
  key: string;
  label: string;
  color: string;
  matches: number;
  accepted: number;
  meetings: number;
}

export interface ConnectionHeatmap {
  /** Role-type groups with >= 2 checked-in attendees, largest first. */
  groups: string[];
  /** Square, symmetric. cell = matches(groups[r], groups[c]) normalized 0-100 against the busiest cell. */
  matrix: number[][];
}

export interface EventStats {
  id: string;
  name: string;
  date: string | null;
  totalRegistrations: number;
  totalCheckedIn: number;
  profilesCreated: number;
  totalMatches: number;
  totalConnectionRequests: number;
  totalMeetingRequests: number;
  meetingsByStatus: {
    requested: number;
    accepted: number;
    declined: number;
    scheduled: number;
    completed: number;
  };
  meetingsConfirmed: number;
  connectionsByStatus: {
    accepted: number;
    declined: number;
    pending: number;
  };
  connectionsWithConversation: number;
  conversationsStarted: number;
  outcomesReported: number;
  avgOverallRating: number | null;
  avgMatchingRating: number | null;
  avgNetworkingQuality: number | null;
  selfReportsTotal: number;
  selfReportsValuable: number;
  feedbackParticipation: { participants: number; checkedIn: number };
  connectionsByDay: ConnectionsByDayPoint[];
  funnel: FunnelStage[];
  roleBreakdown: LabelCount[];
  intentBreakdown: IntentBreakdownEntry[];
  segments: AudienceSegment[];
  relationshipPairs: RelationshipPair[];
  connectionHeatmap: ConnectionHeatmap;
  topExpertise: LabelCount[];
  topInterestsAndCommunities: LabelCount[];
  topIndustries: LabelCount[];
  topLocations: LabelCount[];
}

const CONFIRMED_MEETING_STATUSES = new Set(["accepted", "scheduled", "completed"]);

// Audience segments are intentionally non-exclusive (a founder can also be
// raising capital), so their percentages do not sum to 100. Ordered to match
// the Figma Make prototype's SEGMENTS array.
const EXECUTIVE_SENIORITY = new Set(["Vice President", "Partner"]);
const HIRING_ROLES = new Set(["Recruiter", "Hiring Manager"]);
const PARTNERSHIP_GOALS = new Set([
  "Build Business Partnerships",
  "Find Brand Partners",
  "Find Sponsorship Opportunities",
]);
const OPEN_GOALS = new Set([
  "Explore Opportunities Generally",
  "Meet Great People Without a Specific Ask",
  "Meet Collaborators",
]);

const SEGMENT_DEFS: Array<{ key: string; label: string; test: (profile: ProfileRow) => boolean }> = [
  { key: "c_suite", label: "C-Suite / Executives", test: (p) => p.seniority !== null && EXECUTIVE_SENIORITY.has(p.seniority) },
  { key: "founders", label: "Founders", test: (p) => p.role_type === "Founder / Co-founder" },
  {
    key: "actively_hiring",
    label: "Actively hiring",
    test: (p) => (p.role_type !== null && HIRING_ROLES.has(p.role_type)) || p.primary_goal === "Hire Talent",
  },
  {
    key: "raising_capital",
    label: "Raising capital",
    test: (p) => p.primary_goal === "Raise Capital" || p.primary_goal === "Meet Investors",
  },
  {
    key: "seeking_partnerships",
    label: "Seeking partnerships",
    test: (p) =>
      (p.primary_goal !== null && PARTNERSHIP_GOALS.has(p.primary_goal)) ||
      p.role_type === "Brand / Partnership Leader",
  },
  {
    key: "open_to_opportunities",
    label: "Open to opportunities",
    test: (p) => p.primary_goal !== null && OPEN_GOALS.has(p.primary_goal),
  },
];

// "Candidates" has no dedicated field -- proxy: anyone not in a hiring,
// investing or founding role. Same caveat on "Enterprises"/"Startups" below.
const CANDIDATE_ROLES = new Set([
  "Corporate Professional",
  "Creator / Influencer",
  "Community Builder",
  "Other",
]);

// Cross-group pair cards. Ordered + coloured to match the Figma Make prototype's
// RELATIONSHIP_PAIRS array.
const RELATIONSHIP_PAIR_DEFS: Array<{
  key: string;
  label: string;
  color: string;
  a: (profile: ProfileRow) => boolean;
  b: (profile: ProfileRow) => boolean;
}> = [
  {
    key: "founders_investors",
    label: "Founders ↔ Investors",
    color: "#69C0BE",
    a: (p) => p.role_type === "Founder / Co-founder",
    b: (p) => p.role_type === "Investor",
  },
  {
    key: "recruiters_candidates",
    label: "Recruiters ↔ Candidates",
    color: "#DCE86A",
    a: (p) => p.role_type !== null && HIRING_ROLES.has(p.role_type),
    b: (p) => p.role_type !== null && CANDIDATE_ROLES.has(p.role_type),
  },
  {
    key: "brands_creators",
    label: "Brands ↔ Creators",
    color: "#FF5338",
    a: (p) => p.role_type === "Brand / Partnership Leader",
    b: (p) => p.role_type === "Creator / Influencer",
  },
  {
    key: "enterprises_startups",
    label: "Enterprises ↔ Startups",
    color: "#4387F5",
    a: (p) => p.role_type === "Corporate Professional",
    b: (p) => p.role_type === "Founder / Co-founder",
  },
  {
    key: "executives_founders",
    label: "Executives ↔ Founders",
    color: "#000000",
    a: (p) => p.seniority !== null && EXECUTIVE_SENIORITY.has(p.seniority),
    b: (p) => p.role_type === "Founder / Co-founder",
  },
];

function topSelections(selectionsByAttendee: string[][], limit = 5): LabelCount[] {
  const totals = new Map<string, LabelCount>();
  for (const selections of selectionsByAttendee) {
    const uniqueSelections = new Map<string, string>();
    for (const selection of selections) {
      const label = selection?.trim();
      if (label) uniqueSelections.set(label.toLocaleLowerCase(), label);
    }
    for (const [key, label] of uniqueSelections) {
      const existing = totals.get(key);
      totals.set(key, { label: existing?.label ?? label, count: (existing?.count ?? 0) + 1 });
    }
  }
  return [...totals.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function dayOf(timestamp: string | null): string | null {
  if (!timestamp || timestamp.length < 10) return null;
  return timestamp.slice(0, 10);
}

export function buildEventStats(input: BuildEventStatsInput): EventStats {
  const {
    event,
    registrations,
    profiles,
    matchCount,
    connectionRequestMessageCount,
    matches,
    messages,
    meetings,
    feedback,
    selfReports,
  } = input;

  const registeredProfileIds = new Set(
    registrations.map((registration) => registration.profile_id).filter((id): id is string => Boolean(id)),
  );
  const checkedInProfileIds = new Set(
    registrations
      .filter((registration) => registration.is_checked_in)
      .map((registration) => registration.profile_id)
      .filter((id): id is string => Boolean(id)),
  );
  const eventProfiles = profiles.filter((profile) => registeredProfileIds.has(profile.id));
  const completedProfileIds = new Set(
    eventProfiles.filter((profile) => profile.profile_completed === true).map((profile) => profile.id),
  );

  const totalCheckedIn = registrations.filter((registration) => registration.is_checked_in).length;
  const profilesCreated = registrations.filter(
    (registration) => registration.profile_id && completedProfileIds.has(registration.profile_id),
  ).length;

  const acceptedMatches = matches.filter((match) => match.connection_status === "accepted");
  const acceptedMatchIds = new Set(acceptedMatches.map((match) => match.id));

  const sendersByMatch = new Map<string, Set<string>>();
  const nonRequestMatchIds = new Set<string>();
  for (const message of messages) {
    if (!message.match_id) continue;
    if (message.message_type !== "connect_request") {
      nonRequestMatchIds.add(message.match_id);
    }
    if (!message.sender_id) continue;
    const senders = sendersByMatch.get(message.match_id) ?? new Set<string>();
    senders.add(message.sender_id);
    sendersByMatch.set(message.match_id, senders);
  }

  const connectionsWithConversation = acceptedMatches.filter((match) => {
    const senders = sendersByMatch.get(match.id);
    return Boolean(senders && senders.has(match.user_a_id) && senders.has(match.user_b_id));
  }).length;
  const conversationsStarted = acceptedMatches.filter((match) => nonRequestMatchIds.has(match.id)).length;

  const meetingsByStatus = {
    requested: meetings.filter((meeting) => meeting.status === "requested").length,
    accepted: meetings.filter((meeting) => meeting.status === "accepted").length,
    declined: meetings.filter((meeting) => meeting.status === "declined").length,
    scheduled: meetings.filter((meeting) => meeting.status === "scheduled").length,
    completed: meetings.filter((meeting) => meeting.status === "completed").length,
  };
  const meetingsConfirmed = meetings.filter(
    (meeting) => meeting.status !== null && CONFIRMED_MEETING_STATUSES.has(meeting.status),
  ).length;

  const avgOverallRating = average(
    feedback.map((row) => row.overall_rating).filter((value): value is number => value !== null),
  );
  const avgMatchingRating = average(
    feedback.map((row) => row.matching_rating).filter((value): value is number => value !== null),
  );
  const avgNetworkingQuality = average(
    feedback.map((row) => row.networking_quality).filter((value): value is number => value !== null),
  );

  // "% Self-Reported as Valuable" only makes sense for connections that
  // actually met -- a "not yet met" report carries no verdict.
  const metSelfReports = selfReports.filter((report) => report.response === "met");
  const selfReportsTotal = metSelfReports.length;
  const selfReportsValuable = metSelfReports.filter((report) => report.was_valuable === true).length;
  const outcomesReported = selfReports.length;

  const feedbackParticipants = new Set<string>();
  for (const row of feedback) {
    if (row.user_id && checkedInProfileIds.has(row.user_id)) feedbackParticipants.add(row.user_id);
  }
  for (const report of selfReports) {
    if (report.user_id && checkedInProfileIds.has(report.user_id)) feedbackParticipants.add(report.user_id);
  }

  const connectionsByDayMap = new Map<string, ConnectionsByDayPoint>();
  const pointFor = (date: string) => {
    const existing = connectionsByDayMap.get(date);
    if (existing) return existing;
    const created = { date, connections: 0, meetings: 0 };
    connectionsByDayMap.set(date, created);
    return created;
  };
  for (const match of acceptedMatches) {
    const day = dayOf(match.connection_status_updated_at);
    if (day) pointFor(day).connections += 1;
  }
  for (const meeting of meetings) {
    const day = dayOf(meeting.created_at);
    if (day) pointFor(day).meetings += 1;
  }
  const connectionsByDay = [...connectionsByDayMap.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  const matchedAttendeeIds = new Set<string>();
  for (const match of matches) {
    if (registeredProfileIds.has(match.user_a_id)) matchedAttendeeIds.add(match.user_a_id);
    if (registeredProfileIds.has(match.user_b_id)) matchedAttendeeIds.add(match.user_b_id);
  }
  const requestSent = matches.filter((match) => Boolean(match.connection_requested_by)).length;
  const meetingMatchIds = new Set(
    meetings
      .filter((meeting) => meeting.match_id && meeting.status !== "declined")
      .map((meeting) => meeting.match_id as string),
  );
  const outcomeMatchIds = new Set(
    selfReports.filter((report) => report.match_id).map((report) => report.match_id as string),
  );

  // "Who was in the room" -- every Audience-tab breakdown is scoped to
  // attendees who actually checked in.
  const checkedInProfiles = eventProfiles.filter((profile) => checkedInProfileIds.has(profile.id));
  const roleBreakdown = topSelections(
    checkedInProfiles.map((profile) => (profile.role_type ? [profile.role_type] : [])),
    Infinity,
  );
  const intentBreakdown: IntentBreakdownEntry[] = topSelections(
    checkedInProfiles.map((profile) => (profile.primary_goal ? [profile.primary_goal] : [])),
    Infinity,
  ).map((entry) => ({
    label: entry.label,
    count: entry.count,
    pct: totalCheckedIn > 0 ? Math.round((entry.count / totalCheckedIn) * 100) : 0,
  }));
  const segments: AudienceSegment[] = SEGMENT_DEFS.map((def) => {
    const count = checkedInProfiles.filter(def.test).length;
    return {
      key: def.key,
      label: def.label,
      count,
      pct: totalCheckedIn > 0 ? Math.round((count / totalCheckedIn) * 100) : 0,
    };
  });

  // Relationship patterns -- matches between two checked-in attendees, grouped by
  // how their role/seniority spans a pair or a heatmap cell.
  const checkedInProfileById = new Map(checkedInProfiles.map((profile) => [profile.id, profile]));
  const checkedInMatches = matches.filter(
    (match) => checkedInProfileById.has(match.user_a_id) && checkedInProfileById.has(match.user_b_id),
  );

  const relationshipPairs: RelationshipPair[] = RELATIONSHIP_PAIR_DEFS.map((def) => {
    const spanning = checkedInMatches.filter((match) => {
      const pa = checkedInProfileById.get(match.user_a_id) as ProfileRow;
      const pb = checkedInProfileById.get(match.user_b_id) as ProfileRow;
      return (def.a(pa) && def.b(pb)) || (def.a(pb) && def.b(pa));
    });
    return {
      key: def.key,
      label: def.label,
      color: def.color,
      matches: spanning.length,
      accepted: spanning.filter((match) => match.connection_status === "accepted").length,
      meetings: spanning.filter((match) => meetingMatchIds.has(match.id)).length,
    };
  });

  const heatmapGroups = topSelections(
    checkedInProfiles.map((profile) => (profile.role_type ? [profile.role_type] : [])),
    Infinity,
  )
    .filter((entry) => entry.count >= 2)
    .map((entry) => entry.label);
  const groupIndex = new Map(heatmapGroups.map((group, index) => [group, index]));
  const rawMatrix = heatmapGroups.map(() => heatmapGroups.map(() => 0));
  for (const match of checkedInMatches) {
    const roleA = (checkedInProfileById.get(match.user_a_id) as ProfileRow).role_type;
    const roleB = (checkedInProfileById.get(match.user_b_id) as ProfileRow).role_type;
    const ia = roleA !== null ? groupIndex.get(roleA) : undefined;
    const ib = roleB !== null ? groupIndex.get(roleB) : undefined;
    if (ia === undefined || ib === undefined) continue;
    rawMatrix[ia][ib] += 1;
    if (ia !== ib) rawMatrix[ib][ia] += 1;
  }
  const maxCell = rawMatrix.reduce((max, row) => Math.max(max, ...row), 0);
  const connectionHeatmap: ConnectionHeatmap = {
    groups: heatmapGroups,
    matrix: rawMatrix.map((row) =>
      row.map((cell) => (maxCell > 0 ? Math.round((cell / maxCell) * 100) : 0)),
    ),
  };

  const funnel: FunnelStage[] = [
    { key: "profile_created", label: "Profile created", value: profilesCreated },
    { key: "matched", label: "Matched", value: matchedAttendeeIds.size },
    { key: "request_sent", label: "Request sent", value: requestSent },
    { key: "accepted", label: "Accepted", value: acceptedMatchIds.size },
    { key: "conversation_started", label: "Conversation started", value: conversationsStarted },
    { key: "meeting", label: "Meeting", value: meetingMatchIds.size },
    { key: "outcome_reported", label: "Outcome reported", value: outcomeMatchIds.size },
  ];

  return {
    id: event.id,
    name: event.name,
    date: event.date,
    totalRegistrations: registrations.length,
    totalCheckedIn,
    profilesCreated,
    totalMatches: matchCount,
    totalConnectionRequests: connectionRequestMessageCount,
    totalMeetingRequests: meetings.length,
    meetingsByStatus,
    meetingsConfirmed,
    connectionsByStatus: {
      accepted: acceptedMatches.length,
      declined: matches.filter((match) => match.connection_status === "declined").length,
      pending: matches.filter((match) => match.connection_status === "pending").length,
    },
    connectionsWithConversation,
    conversationsStarted,
    outcomesReported,
    avgOverallRating,
    avgMatchingRating,
    avgNetworkingQuality,
    selfReportsTotal,
    selfReportsValuable,
    feedbackParticipation: { participants: feedbackParticipants.size, checkedIn: totalCheckedIn },
    connectionsByDay,
    funnel,
    roleBreakdown,
    intentBreakdown,
    segments,
    relationshipPairs,
    connectionHeatmap,
    topExpertise: topSelections(checkedInProfiles.map((profile) => profile.areas_of_expertise ?? [])),
    topInterestsAndCommunities: topSelections(
      checkedInProfiles.map((profile) => [...(profile.interests ?? []), ...(profile.communities ?? [])]),
    ),
    topIndustries: topSelections(checkedInProfiles.map((profile) => profile.industries ?? [])),
    topLocations: topSelections(checkedInProfiles.map((profile) => (profile.location ? [profile.location] : []))),
  };
}
