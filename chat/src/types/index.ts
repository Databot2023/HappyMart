// ─────────────────────────────────────────────────────────────────────────────
// src/types/index.ts  –  Shared type definitions for KeetChat
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  numericId: string;       // "123 456 789 0"  (10 digits, formatted)
  alias?: string;          // "alice@keet"
  publicKeyHex: string;    // 64-char hex from hypercore-crypto
  createdAt: number;
}

export interface Friend {
  numericId: string;
  alias?: string;
  publicKeyHex: string;
  addedAt: number;
  online: boolean;
}

export interface FriendRequest {
  id: string;              // random UUID
  fromId: string;
  fromAlias?: string;
  fromPublicKey: string;
  toId: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined';
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  timestamp: number;
  delivered: boolean;
  isLocal: boolean;
}

export interface Conversation {
  peerId: string;           // numeric ID of the other party
  peerAlias?: string;
  messages: Message[];
  unreadCount: number;
  lastMessage?: Message;
}

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended';

export interface CallSession {
  peerId: string;
  peerAlias?: string;
  isVideo: boolean;
  state: CallState;
  startedAt?: number;
  pc?: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
}

export type Screen =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'chat'
  | 'call'
  | 'addFriend'
  | 'friendRequests'
  | 'settings';
