// ============================================================
// meeting.types.ts — TypeScript Interfaces cho Meeting APIs
// Matches all Backend REST + STOMP payloads exactly.
// ============================================================

// ── Host Settings ─────────────────────────────────────────────────────────────
/** type param for PUT /api/v1/meetings/{meetingCode}/host/settings */
export type HostSettingType = 'LOCK_MEETING' | 'WAITING_ROOM' | 'DISABLE_SCREEN_SHARE';

// ── Host Commands ─────────────────────────────────────────────────────────────
/** command param for POST /api/v1/meetings/{meetingCode}/host/command */
export type HostCommandType = 'MUTE_ALL' | 'KICK_PARTICIPANT';

// ── Raise Hand Participant ────────────────────────────────────────────────────
/** A participant who has raised their hand — matches backend ParticipantDto */
export interface RaisedHandParticipant {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: 'RAISING_HAND';
}

// ── GET /api/v1/meetings/{meetingCode}/actions/raised-hands ───────────────────
export interface RaisedHandsResponse {
  meetingCode: string;
  totalCount: number;
  participants: RaisedHandParticipant[];
}

// ── STOMP Topic: /topic/meeting.{meetingCode}.commands ────────────────────────
/** Payload pushed from backend on host command events */
export interface HostCommandPayload {
  action: 'MUTE_ALL' | 'KICK' | 'SETTING_CHANGED';
  /** Present when action === 'KICK' */
  targetId?: string;
  /** Present when action === 'SETTING_CHANGED' */
  type?: HostSettingType;
  /** Present when action === 'SETTING_CHANGED' */
  enabled?: boolean;
}

// ── STOMP Topic: /topic/meeting.{meetingCode}.raised-hands ────────────────────
/** RAISE event — a participant raised their hand */
export interface RaiseHandEvent {
  action: 'RAISE';
  data: RaisedHandParticipant;
}

/** LOWER event — a participant lowered their hand */
export interface LowerHandEvent {
  action: 'LOWER';
  userId: string;
}

/** Union type for all raised-hand WebSocket events */
export type RaisedHandSocketPayload = RaiseHandEvent | LowerHandEvent;

// ── Poll DTOs ────────────────────────────────────────────────────────────────

export interface PollOptionResponse {
  id: string;
  text: string;
  voteCount: number;
  /** True nếu user gọi API này đã vote cho option này */
  votedByMe: boolean;
}

export interface PollResponse {
  id: string;
  question: string;
  isMultipleChoice: boolean;
  status: 'OPEN' | 'CLOSED';
  options: PollOptionResponse[];
  hasVoted: boolean;
  totalVotes: number;
}

export interface PollCreateRequest {
  question: string;
  options: string[];
  isMultipleChoice: boolean;
}

// ── STOMP Topic: /topic/meeting.{meetingCode}.polls ──────────────────────────

export interface PollCreatedPayload {
  action: 'POLL_CREATED';
  data: PollResponse;
}

export interface VoteUpdatedPayload {
  action: 'VOTE_UPDATED';
  pollId: string;
  optionId: string;
  newCounts: Record<string, string | number>;
}

export interface PollClosedPayload {
  action: 'POLL_CLOSED';
  pollId: string;
}

export type PollSocketPayload = PollCreatedPayload | VoteUpdatedPayload | PollClosedPayload;
