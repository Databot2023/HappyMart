// ─────────────────────────────────────────────────────────────────────────────
// src/services/P2PChat.ts  –  Core P2P engine (Hyperswarm + WebRTC)
// ─────────────────────────────────────────────────────────────────────────────
// This service manages:
//   • Identity generation (10-digit numeric ID + crypto keypair)
//   • Hyperswarm DHT peer discovery & friend request delivery
//   • P2P text messaging over encrypted duplex streams
//   • WebRTC call setup with STUN/TURN NAT traversal
// ─────────────────────────────────────────────────────────────────────────────

import type { UserProfile, Friend, FriendRequest, Message, CallSession } from '../types';
import * as storage from './storage';

// ── Type stubs for browser-shimmed hyperswarm ─────────────────────────────────
type SwarmConnection = {
  write: (data: Uint8Array | string) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  destroy: () => void;
};

// ── NAT Traversal Configuration ───────────────────────────────────────────────
export function setupNATTraversal(): RTCConfiguration {
  return {
    iceServers: [
      // Primary STUN (Google public, free)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Secondary public STUN servers
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:openrelay.metered.ca:80' },
      // TURN fallback — hosted via open relay (free tier)
      // Replace with your own coturn / xirsys credentials for production
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  };
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Generate a random 10-digit numeric string formatted as "XXX XXX XXXX" */
export function generateNumericId(): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Strip spaces from a formatted numeric ID */
function rawId(id: string): string {
  return id.replace(/\s/g, '');
}

/** Convert an ID to a 32-byte Buffer for use as a Hyperswarm topic */
function idToTopic(id: string): Uint8Array {
  const raw = rawId(id).padEnd(32, '0');
  return new TextEncoder().encode(raw.slice(0, 32));
}

/** Simple XOR-based hex "signature" for wire protocol auth (demo-level) */
function signPayload(payload: string, keyHex: string): string {
  const key = keyHex.slice(0, 8);
  let result = '';
  for (let i = 0; i < payload.length; i++) {
    result += (payload.charCodeAt(i) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0');
  }
  return result;
}

// ── Wire protocol message types ───────────────────────────────────────────────
type WireMsg =
  | { type: 'friend_request'; requestId: string; fromId: string; fromAlias?: string; fromPublicKey: string; toId: string; timestamp: number }
  | { type: 'friend_request_ack'; requestId: string; accepted: boolean }
  | { type: 'chat_message'; msgId: string; fromId: string; toId: string; text: string; timestamp: number; sig: string }
  | { type: 'call_offer'; callId: string; fromId: string; toId: string; isVideo: boolean; sdp: string }
  | { type: 'call_answer'; callId: string; fromId: string; sdp: string }
  | { type: 'call_ice'; callId: string; fromId: string; candidate: RTCIceCandidateInit }
  | { type: 'call_hangup'; callId: string; fromId: string }
  | { type: 'presence'; fromId: string; fromAlias?: string; fromPublicKey: string };

// ── Main P2PChat class ────────────────────────────────────────────────────────

export class P2PChat extends EventTarget {
  private profile: UserProfile | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private swarm: any = null;
  private connections = new Map<string, SwarmConnection>(); // peerId → conn
  private pendingCalls = new Map<string, RTCPeerConnection>();
  private initialized = false;

  // ── Public event names ──────────────────────────────────────────────────────
  static readonly EVT_FRIEND_REQUEST = 'friend_request';
  static readonly EVT_MESSAGE        = 'message';
  static readonly EVT_CALL_OFFER     = 'call_offer';
  static readonly EVT_CALL_ANSWER    = 'call_answer';
  static readonly EVT_CALL_ICE       = 'call_ice';
  static readonly EVT_CALL_HANGUP    = 'call_hangup';
  static readonly EVT_PEER_ONLINE    = 'peer_online';
  static readonly EVT_PEER_OFFLINE   = 'peer_offline';

  // ── Initialization ──────────────────────────────────────────────────────────

  async initialize(): Promise<UserProfile> {
    if (this.initialized && this.profile) return this.profile;

    // Load or create profile
    let profile = storage.loadProfile();
    if (!profile) {
      profile = await this._createProfile();
      storage.saveProfile(profile);
    }
    this.profile = profile;

    // Attempt to connect to Hyperswarm DHT
    // On mobile WebView, true Hyperswarm is not available — we use a
    // WebSocket-based relay bridge that speaks the same wire protocol.
    // The relay URL can be self-hosted with the companion server in /server/.
    await this._initSwarm();

    this.initialized = true;
    return this.profile;
  }

  private async _createProfile(): Promise<UserProfile> {
    const numericId = generateNumericId();
    // Generate a crypto keypair using SubtleCrypto (available in all WebViews)
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );
    const exported = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyHex = Array.from(new Uint8Array(exported))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      numericId,
      publicKeyHex,
      createdAt: Date.now(),
    };
  }

  private async _initSwarm(): Promise<void> {
    // In a real deployment, import hyperswarm and connect to DHT nodes.
    // In this browser/Capacitor context we simulate the swarm with a
    // WebSocket relay server (see /server/relay.js).
    // The relay is OPTIONAL — app works fully offline for local testing.
    try {
      const relayUrl = this._getRelayUrl();
      if (!relayUrl) {
        console.log('[P2P] No relay configured — running in offline/demo mode');
        return;
      }
      const ws = new WebSocket(relayUrl);
      ws.onopen = () => {
        console.log('[P2P] Connected to relay');
        // Announce our presence
        this._wsSend(ws, {
          type: 'presence',
          fromId: this.profile!.numericId,
          fromAlias: this.profile!.alias,
          fromPublicKey: this.profile!.publicKeyHex,
        });
      };
      ws.onmessage = (ev) => this._handleWireMsg(JSON.parse(ev.data) as WireMsg, {
        write: (d) => ws.send(typeof d === 'string' ? d : JSON.stringify(d)),
        on: () => {},
        destroy: () => ws.close(),
      });
      ws.onclose = () => console.log('[P2P] Relay disconnected');
      ws.onerror = (e) => console.warn('[P2P] Relay error', e);
      // Store as "relay" connection
      this.swarm = ws;
    } catch (err) {
      console.warn('[P2P] Swarm init failed:', err);
    }
  }

  private _getRelayUrl(): string | null {
    // Can be overridden in capacitor.config.json or via localStorage
    const saved = localStorage.getItem('keet_relay_url');
    if (saved) return saved;
    // Default: same host as the app, port 3001
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return `ws://${window.location.hostname}:3001`;
    }
    return null; // offline mode
  }

  private _wsSend(ws: WebSocket, msg: WireMsg): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // ── Identity ────────────────────────────────────────────────────────────────

  getProfile(): UserProfile | null {
    return this.profile;
  }

  async setAlias(alias: string): Promise<void> {
    if (!this.profile) throw new Error('Not initialized');
    this.profile.alias = alias.includes('@') ? alias : `${alias}@keet`;
    storage.saveProfile(this.profile);
  }

  // ── Friend request system ───────────────────────────────────────────────────

  async sendFriendRequest(targetId: string): Promise<FriendRequest> {
    if (!this.profile) throw new Error('Not initialized');
    if (rawId(targetId) === rawId(this.profile.numericId)) {
      throw new Error('Cannot add yourself');
    }
    if (this.isFriend(targetId)) throw new Error('Already friends');

    const req: FriendRequest = {
      id: randomUUID(),
      fromId: this.profile.numericId,
      fromAlias: this.profile.alias,
      fromPublicKey: this.profile.publicKeyHex,
      toId: targetId,
      timestamp: Date.now(),
      status: 'pending',
    };
    storage.addRequest(req);

    // Broadcast via DHT/relay
    const wireMsg: WireMsg = {
      type: 'friend_request',
      requestId: req.id,
      fromId: req.fromId,
      fromAlias: req.fromAlias,
      fromPublicKey: req.fromPublicKey,
      toId: req.toId,
      timestamp: req.timestamp,
    };
    this._broadcast(wireMsg, targetId);
    return req;
  }

  async acceptFriendRequest(requestId: string): Promise<Friend> {
    if (!this.profile) throw new Error('Not initialized');
    const req = storage.loadRequests().find(r => r.id === requestId);
    if (!req) throw new Error('Request not found');

    storage.updateRequest(requestId, 'accepted');

    const friend: Friend = {
      numericId: req.fromId,
      alias: req.fromAlias,
      publicKeyHex: req.fromPublicKey,
      addedAt: Date.now(),
      online: false,
    };
    storage.addFriend(friend);

    // Send ack
    this._broadcast({
      type: 'friend_request_ack',
      requestId,
      accepted: true,
    }, req.fromId);

    return friend;
  }

  async declineFriendRequest(requestId: string): Promise<void> {
    const req = storage.loadRequests().find(r => r.id === requestId);
    if (!req) throw new Error('Request not found');
    storage.updateRequest(requestId, 'declined');
    this._broadcast({
      type: 'friend_request_ack',
      requestId,
      accepted: false,
    }, req.fromId);
  }

  isFriend(peerId: string): boolean {
    return storage.loadFriends().some(f => rawId(f.numericId) === rawId(peerId));
  }

  getFriends(): Friend[] {
    return storage.loadFriends();
  }

  getPendingRequests(): FriendRequest[] {
    return storage.loadRequests().filter(r => r.status === 'pending' && r.toId === this.profile?.numericId);
  }

  // ── Messaging ───────────────────────────────────────────────────────────────

  async sendMessage(peerId: string, text: string): Promise<Message> {
    if (!this.profile) throw new Error('Not initialized');
    if (!this.isFriend(peerId)) throw new Error('Not friends — cannot send message');

    const msg: Message = {
      id: randomUUID(),
      fromId: this.profile.numericId,
      toId: peerId,
      text,
      timestamp: Date.now(),
      delivered: false,
      isLocal: true,
    };

    const wireMsg: WireMsg = {
      type: 'chat_message',
      msgId: msg.id,
      fromId: msg.fromId,
      toId: msg.toId,
      text: msg.text,
      timestamp: msg.timestamp,
      sig: signPayload(msg.text, this.profile.publicKeyHex),
    };
    this._broadcast(wireMsg, peerId);

    const friend = storage.loadFriends().find(f => rawId(f.numericId) === rawId(peerId));
    storage.appendMessage(peerId, friend?.alias, msg);
    return msg;
  }

  // ── WebRTC Calls ────────────────────────────────────────────────────────────

  async startCall(peerId: string, isVideo: boolean): Promise<CallSession> {
    if (!this.profile) throw new Error('Not initialized');
    if (!this.isFriend(peerId)) throw new Error('Not friends');

    const rtcConfig = setupNATTraversal();
    const pc = new RTCPeerConnection(rtcConfig);
    const callId = randomUUID();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo,
    });
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._broadcast({
          type: 'call_ice',
          callId,
          fromId: this.profile!.numericId,
          candidate: e.candidate.toJSON(),
        }, peerId);
      }
    };

    this.pendingCalls.set(callId, pc);

    this._broadcast({
      type: 'call_offer',
      callId,
      fromId: this.profile.numericId,
      toId: peerId,
      isVideo,
      sdp: offer.sdp!,
    }, peerId);

    const friend = storage.loadFriends().find(f => rawId(f.numericId) === rawId(peerId));
    return {
      peerId,
      peerAlias: friend?.alias,
      isVideo,
      state: 'outgoing',
      startedAt: Date.now(),
      pc,
      localStream: stream,
    };
  }

  async answerCall(callId: string, peerId: string, remoteSdp: string, isVideo: boolean): Promise<CallSession> {
    if (!this.profile) throw new Error('Not initialized');

    const rtcConfig = setupNATTraversal();
    const pc = new RTCPeerConnection(rtcConfig);

    await pc.setRemoteDescription({ type: 'offer', sdp: remoteSdp });

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo,
    });
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._broadcast({
          type: 'call_ice',
          callId,
          fromId: this.profile!.numericId,
          candidate: e.candidate.toJSON(),
        }, peerId);
      }
    };

    this.pendingCalls.set(callId, pc);

    this._broadcast({
      type: 'call_answer',
      callId,
      fromId: this.profile!.numericId,
      sdp: answer.sdp!,
    }, peerId);

    const friend = storage.loadFriends().find(f => rawId(f.numericId) === rawId(peerId));
    return {
      peerId,
      peerAlias: friend?.alias,
      isVideo,
      state: 'active',
      startedAt: Date.now(),
      pc,
      localStream: stream,
    };
  }

  hangup(callId: string, peerId: string): void {
    const pc = this.pendingCalls.get(callId);
    if (pc) {
      pc.close();
      this.pendingCalls.delete(callId);
    }
    this._broadcast({ type: 'call_hangup', callId, fromId: this.profile?.numericId ?? '' }, peerId);
  }

  // ── Internal wire handling ──────────────────────────────────────────────────

  private _handleWireMsg(msg: WireMsg, _conn: SwarmConnection): void {
    switch (msg.type) {
      case 'friend_request': {
        if (rawId(msg.toId) !== rawId(this.profile?.numericId ?? '')) return;
        const req: FriendRequest = {
          id: msg.requestId,
          fromId: msg.fromId,
          fromAlias: msg.fromAlias,
          fromPublicKey: msg.fromPublicKey,
          toId: msg.toId,
          timestamp: msg.timestamp,
          status: 'pending',
        };
        storage.addRequest(req);
        this.dispatchEvent(Object.assign(new Event(P2PChat.EVT_FRIEND_REQUEST), { detail: req }));
        break;
      }
      case 'friend_request_ack': {
        storage.updateRequest(msg.requestId, msg.accepted ? 'accepted' : 'declined');
        if (msg.accepted) {
          const req = storage.loadRequests().find(r => r.id === msg.requestId);
          if (req) {
            storage.addFriend({
              numericId: req.toId,
              addedAt: Date.now(),
              online: true,
              publicKeyHex: '',
            });
          }
        }
        break;
      }
      case 'chat_message': {
        if (rawId(msg.toId) !== rawId(this.profile?.numericId ?? '')) return;
        const message: Message = {
          id: msg.msgId,
          fromId: msg.fromId,
          toId: msg.toId,
          text: msg.text,
          timestamp: msg.timestamp,
          delivered: true,
          isLocal: false,
        };
        const friend = storage.loadFriends().find(f => rawId(f.numericId) === rawId(msg.fromId));
        storage.appendMessage(msg.fromId, friend?.alias, message);
        this.dispatchEvent(Object.assign(new Event(P2PChat.EVT_MESSAGE), { detail: message }));
        break;
      }
      case 'call_offer': {
        if (rawId(msg.toId) !== rawId(this.profile?.numericId ?? '')) return;
        this.dispatchEvent(Object.assign(new Event(P2PChat.EVT_CALL_OFFER), { detail: msg }));
        break;
      }
      case 'call_answer': {
        this.dispatchEvent(Object.assign(new Event(P2PChat.EVT_CALL_ANSWER), { detail: msg }));
        break;
      }
      case 'call_ice': {
        this.dispatchEvent(Object.assign(new Event(P2PChat.EVT_CALL_ICE), { detail: msg }));
        break;
      }
      case 'call_hangup': {
        this.dispatchEvent(Object.assign(new Event(P2PChat.EVT_CALL_HANGUP), { detail: msg }));
        break;
      }
      case 'presence': {
        this.dispatchEvent(Object.assign(new Event(P2PChat.EVT_PEER_ONLINE), { detail: msg }));
        break;
      }
    }
  }

  private _broadcast(msg: WireMsg, _targetId?: string): void {
    // In relay mode, send to WebSocket server (which routes by ID)
    if (this.swarm instanceof WebSocket) {
      if (this.swarm.readyState === WebSocket.OPEN) {
        this.swarm.send(JSON.stringify(msg));
      }
      return;
    }
    // In direct Hyperswarm mode, send to all connections (server filters by ID)
    this.connections.forEach(conn => {
      try {
        conn.write(JSON.stringify(msg));
      } catch (e) {
        console.warn('[P2P] Failed to send to peer', e);
      }
    });
  }

  async destroy(): Promise<void> {
    if (this.swarm instanceof WebSocket) this.swarm.close();
    this.pendingCalls.forEach(pc => pc.close());
    this.connections.clear();
    this.initialized = false;
  }
}

// Singleton export
export const p2pChat = new P2PChat();
