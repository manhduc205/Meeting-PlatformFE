export interface Participant {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isHost: boolean;
  isSpeaking: boolean;
  isHandRaised: boolean;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  /** Real WebRTC/LiveKit media stream (undefined = camera off / not yet received) */
  stream?: MediaStream;
  /** Audio level 0-1 from LiveKit ActiveSpeakersChanged */
  audioLevel?: number;
  /** LiveKit connection state for this participant */
  connectionState?: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isMe?: boolean;
  emoji?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  votedOption?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface TranscriptEntry {
  time: string;
  speaker: string;
  text: string;
}

export type SidebarTab = 'participants' | 'chat' | 'polls' | 'qa';
export type AITab = 'summary' | 'actions' | 'transcript' | 'ask';

export interface AskMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  loading?: boolean;
}
