export interface ConnectionMessageFact {
  id: string;
  match_id: string | null;
  event_id: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  message_type: string | null;
  created_at: string | null;
}

export interface ConnectionMeetingFact {
  id: string;
  match_id: string | null;
  event_id: string | null;
  requester_id: string;
  recipient_id: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
}

export interface ConnectionStatusFact {
  status: string;
  requestedBy: string | null;
}

export interface ConnectionPersonSummary {
  personId: string;
  matchId: string | null;
  eventId: string | null;
  status: string;
  statusColor: string;
  isInMotion: boolean;
  hasCompletedMeeting: boolean;
  connectionStatus: string;
  isPendingOnMe: boolean;
}

export interface ConnectionSummary {
  people: ConnectionPersonSummary[];
  conversationCount: number;
  peopleMetCount: number;
  inMotionCount: number;
}

const RELEVANT_MEETING_STATUSES = new Set(["requested", "accepted", "scheduled", "completed", "declined", "cancelled"]);
const ACTIVE_MEETING_STATUSES = new Set(["requested", "accepted", "scheduled"]);

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function otherMessageParticipant(message: ConnectionMessageFact, userId: string) {
  return message.sender_id === userId ? message.recipient_id : message.sender_id;
}

function otherMeetingParticipant(meeting: ConnectionMeetingFact, userId: string) {
  return meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id;
}

function messageStatus(messages: ConnectionMessageFact[], userId: string) {
  const senders = new Set(messages.map((message) => message.sender_id).filter(Boolean));
  if (senders.has(userId) && [...senders].some((sender) => sender !== userId)) {
    return "Conversation started";
  }
  const request = messages.find((message) => message.message_type === "connect_request");
  if (request?.sender_id === userId) return "Connection request sent";
  if (request) return "Connection request received";
  return "Conversation started";
}

export function buildConnectionSummary(
  userId: string,
  messages: ConnectionMessageFact[],
  meetings: ConnectionMeetingFact[],
  connectionStatuses: Map<string, ConnectionStatusFact> = new Map(),
): ConnectionSummary {
  const validMessages = messages.filter((message) => {
    const otherId = otherMessageParticipant(message, userId);
    return Boolean(message.match_id && otherId && otherId !== userId);
  });
  const validMeetings = meetings.filter((meeting) => {
    const otherId = otherMeetingParticipant(meeting, userId);
    return Boolean(otherId && otherId !== userId);
  });

  const conversationCount = new Set(validMessages.map((message) => message.match_id)).size;
  const personIds = new Set<string>();
  for (const message of validMessages) personIds.add(otherMessageParticipant(message, userId)!);
  for (const meeting of validMeetings) personIds.add(otherMeetingParticipant(meeting, userId));

  const people = [...personIds].map((personId): ConnectionPersonSummary => {
    const personMessages = validMessages
      .filter((message) => otherMessageParticipant(message, userId) === personId)
      .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at));
    const personMeetings = validMeetings
      .filter((meeting) => otherMeetingParticipant(meeting, userId) === personId);
    const relevantMeetings = personMeetings
      .filter((meeting) => RELEVANT_MEETING_STATUSES.has(meeting.status))
      .sort((a, b) => timestamp(b.requested_at) - timestamp(a.requested_at) || b.id.localeCompare(a.id));
    const latestMeeting = relevantMeetings[0];
    const latestMessage = personMessages[0];
    const hasCompletedMeeting = personMeetings.some((meeting) => meeting.status === "completed");
    const matchId = personMessages[0]?.match_id ?? personMeetings[0]?.match_id ?? null;
    const connectionFact = matchId ? connectionStatuses.get(matchId) : undefined;
    const connectionStatus = connectionFact?.status ?? "none";
    const isPendingOnMe = connectionStatus === "pending" && connectionFact?.requestedBy !== userId;

    // The explicit connection_status is authoritative for the two states
    // message/meeting history can't represent: declined (no further
    // reciprocal message ever proves this) and which direction a pending
    // request is waiting in. Active/completed meetings still take priority
    // when they exist, since that's a richer signal than the connection
    // state alone.
    if (connectionStatus === "declined" && (!latestMeeting || !ACTIVE_MEETING_STATUSES.has(latestMeeting.status))) {
      return {
        personId,
        matchId,
        eventId: latestMessage?.event_id ?? latestMeeting?.event_id ?? null,
        status: "Connection declined",
        statusColor: "#6B6B6B",
        isInMotion: false,
        hasCompletedMeeting,
        connectionStatus,
        isPendingOnMe: false,
      };
    }

    if (latestMeeting && ACTIVE_MEETING_STATUSES.has(latestMeeting.status)) {
      const labels: Record<string, string> = {
        requested: "Meeting requested",
        accepted: "Planning a meeting",
        scheduled: "Meeting confirmed",
      };
      return {
        personId,
        matchId,
        eventId: latestMeeting.event_id,
        status: labels[latestMeeting.status],
        statusColor: latestMeeting.status === "scheduled" ? "#69C0BE" : "#DCE86A",
        isInMotion: true,
        hasCompletedMeeting,
        connectionStatus,
        isPendingOnMe,
      };
    }

    if (latestMeeting?.status === "completed") {
      const completedAt = timestamp(latestMeeting.completed_at ?? latestMeeting.requested_at);
      if (!latestMessage || timestamp(latestMessage.created_at) <= completedAt) {
        return {
          personId,
          matchId,
          eventId: latestMeeting.event_id,
          status: "Meeting completed",
          statusColor: "#69C0BE",
          isInMotion: false,
          hasCompletedMeeting,
          connectionStatus,
          isPendingOnMe,
        };
      }
    }

    if (latestMeeting && ["declined", "cancelled"].includes(latestMeeting.status)) {
      const terminalAt = timestamp(latestMeeting.requested_at);
      if (!latestMessage || timestamp(latestMessage.created_at) <= terminalAt) {
        return {
          personId,
          matchId,
          eventId: latestMeeting.event_id,
          status: latestMeeting.status === "declined" ? "Meeting declined" : "Meeting cancelled",
          statusColor: "#6B6B6B",
          isInMotion: false,
          hasCompletedMeeting,
          connectionStatus,
          isPendingOnMe,
        };
      }
    }

    // Once accepted, that's authoritative even if the accepter hasn't sent
    // a reciprocal message yet (accepting is a DB action now, not a reply) --
    // otherwise this would still read as "request sent/received" forever.
    const fallbackStatus = isPendingOnMe
      ? "Connection request received"
      : connectionStatus === "accepted"
        ? (personMessages.length > 1 ? "Conversation started" : "Connected")
        : messageStatus(personMessages, userId);

    return {
      personId,
      matchId,
      eventId: latestMessage?.event_id ?? latestMeeting?.event_id ?? null,
      status: fallbackStatus,
      statusColor: "#4387F5",
      isInMotion: personMessages.length > 0 || connectionStatus === "accepted",
      hasCompletedMeeting,
      connectionStatus,
      isPendingOnMe,
    };
  });

  return {
    people,
    conversationCount,
    peopleMetCount: people.filter((person) => person.hasCompletedMeeting).length,
    inMotionCount: people.filter((person) => person.isInMotion).length,
  };
}
