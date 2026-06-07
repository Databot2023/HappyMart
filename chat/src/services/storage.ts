// ─────────────────────────────────────────────────────────────────────────────
// src/services/storage.ts  –  Persistent local storage wrapper
// ─────────────────────────────────────────────────────────────────────────────
import type { UserProfile, Friend, FriendRequest, Message, Conversation } from '../types';

const KEYS = {
  PROFILE: 'keet_profile',
  FRIENDS: 'keet_friends',
  REQUESTS: 'keet_requests',
  CONVERSATIONS: 'keet_conversations',
};

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Profile ──────────────────────────────────────────────────────────────────
export function loadProfile(): UserProfile | null {
  return get<UserProfile>(KEYS.PROFILE);
}

export function saveProfile(profile: UserProfile): void {
  set(KEYS.PROFILE, profile);
}

// ── Friends ───────────────────────────────────────────────────────────────────
export function loadFriends(): Friend[] {
  return get<Friend[]>(KEYS.FRIENDS) ?? [];
}

export function saveFriends(friends: Friend[]): void {
  set(KEYS.FRIENDS, friends);
}

export function addFriend(friend: Friend): void {
  const friends = loadFriends();
  if (!friends.find(f => f.numericId === friend.numericId)) {
    friends.push(friend);
    saveFriends(friends);
  }
}

export function removeFriend(numericId: string): void {
  const friends = loadFriends().filter(f => f.numericId !== numericId);
  saveFriends(friends);
}

// ── Friend Requests ───────────────────────────────────────────────────────────
export function loadRequests(): FriendRequest[] {
  return get<FriendRequest[]>(KEYS.REQUESTS) ?? [];
}

export function saveRequests(reqs: FriendRequest[]): void {
  set(KEYS.REQUESTS, reqs);
}

export function addRequest(req: FriendRequest): void {
  const reqs = loadRequests();
  if (!reqs.find(r => r.id === req.id)) {
    reqs.push(req);
    saveRequests(reqs);
  }
}

export function updateRequest(id: string, status: FriendRequest['status']): void {
  const reqs = loadRequests().map(r => r.id === id ? { ...r, status } : r);
  saveRequests(reqs);
}

// ── Conversations ─────────────────────────────────────────────────────────────
export function loadConversations(): Conversation[] {
  return get<Conversation[]>(KEYS.CONVERSATIONS) ?? [];
}

export function saveConversations(convs: Conversation[]): void {
  set(KEYS.CONVERSATIONS, convs);
}

export function appendMessage(peerId: string, peerAlias: string | undefined, msg: Message): void {
  const convs = loadConversations();
  const idx = convs.findIndex(c => c.peerId === peerId);
  if (idx >= 0) {
    convs[idx].messages.push(msg);
    convs[idx].lastMessage = msg;
    if (!msg.isLocal) convs[idx].unreadCount++;
  } else {
    convs.push({
      peerId,
      peerAlias,
      messages: [msg],
      unreadCount: msg.isLocal ? 0 : 1,
      lastMessage: msg,
    });
  }
  saveConversations(convs);
}

export function markRead(peerId: string): void {
  const convs = loadConversations().map(c =>
    c.peerId === peerId ? { ...c, unreadCount: 0 } : c
  );
  saveConversations(convs);
}
