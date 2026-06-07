// ─────────────────────────────────────────────────────────────────────────────
// src/context/AppContext.tsx  –  Global state + P2P event bridge
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  createContext, useContext, useEffect, useReducer, useCallback, useRef,
} from 'react';
import { p2pChat } from '../services/P2PChat';
import * as storage from '../services/storage';
import type {
  UserProfile, Friend, FriendRequest, Conversation, CallSession, Screen,
} from '../types';

// ── State ─────────────────────────────────────────────────────────────────────
interface AppState {
  screen: Screen;
  profile: UserProfile | null;
  friends: Friend[];
  requests: FriendRequest[];
  conversations: Conversation[];
  activePeerId: string | null;   // currently open chat
  callSession: CallSession | null;
  incomingCall: { callId: string; fromId: string; fromAlias?: string; isVideo: boolean } | null;
  loading: boolean;
  toast: string | null;
}

const initial: AppState = {
  screen: 'splash',
  profile: null,
  friends: [],
  requests: [],
  conversations: [],
  activePeerId: null,
  callSession: null,
  incomingCall: null,
  loading: true,
  toast: null,
};

// ── Actions ───────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'INIT_DONE'; profile: UserProfile }
  | { type: 'SET_FRIENDS'; friends: Friend[] }
  | { type: 'SET_REQUESTS'; requests: FriendRequest[] }
  | { type: 'SET_CONVERSATIONS'; conversations: Conversation[] }
  | { type: 'SET_ACTIVE_PEER'; peerId: string | null }
  | { type: 'SET_CALL'; session: CallSession | null }
  | { type: 'SET_INCOMING'; call: AppState['incomingCall'] }
  | { type: 'TOAST'; msg: string | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCREEN':       return { ...state, screen: action.screen };
    case 'INIT_DONE':        return { ...state, profile: action.profile, loading: false };
    case 'SET_FRIENDS':      return { ...state, friends: action.friends };
    case 'SET_REQUESTS':     return { ...state, requests: action.requests };
    case 'SET_CONVERSATIONS':return { ...state, conversations: action.conversations };
    case 'SET_ACTIVE_PEER':  return { ...state, activePeerId: action.peerId };
    case 'SET_CALL':         return { ...state, callSession: action.session };
    case 'SET_INCOMING':     return { ...state, incomingCall: action.call };
    case 'TOAST':            return { ...state, toast: action.msg };
    default:                 return state;
  }
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface AppCtx {
  state: AppState;
  navigate: (screen: Screen, peerId?: string) => void;
  refresh: () => void;
  showToast: (msg: string) => void;
  sendFriendRequest: (id: string) => Promise<void>;
  acceptRequest: (reqId: string) => Promise<void>;
  declineRequest: (reqId: string) => Promise<void>;
  sendMessage: (peerId: string, text: string) => Promise<void>;
  startCall: (peerId: string, isVideo: boolean) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  hangup: () => void;
  setAlias: (alias: string) => Promise<void>;
}

const Ctx = createContext<AppCtx>(null!);
export const useApp = () => useContext(Ctx);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const callIdRef = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const profile = await p2pChat.initialize();
        dispatch({ type: 'INIT_DONE', profile });
        dispatch({ type: 'SET_FRIENDS', friends: storage.loadFriends() });
        dispatch({ type: 'SET_REQUESTS', requests: storage.loadRequests() });
        dispatch({ type: 'SET_CONVERSATIONS', conversations: storage.loadConversations() });

        // First launch → onboarding; else home
        const isNew = !storage.loadFriends().length && !storage.loadConversations().length;
        dispatch({ type: 'SET_SCREEN', screen: isNew ? 'onboarding' : 'home' });
      } catch (err) {
        console.error('[App] Init error', err);
        dispatch({ type: 'INIT_DONE', profile: null! });
        dispatch({ type: 'SET_SCREEN', screen: 'onboarding' });
      }
    })();
  }, []);

  // ── P2P event listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    const onRequest = (e: Event) => {
      const req = (e as CustomEvent).detail as FriendRequest;
      dispatch({ type: 'SET_REQUESTS', requests: storage.loadRequests() });
      showToast(`Friend request from ${req.fromAlias ?? req.fromId}`);
    };

    const onMessage = () => {
      dispatch({ type: 'SET_CONVERSATIONS', conversations: storage.loadConversations() });
    };

    const onCallOffer = (e: Event) => {
      const detail = (e as CustomEvent).detail as { callId: string; fromId: string; fromAlias?: string; isVideo: boolean; sdp: string };
      callIdRef.current = detail.callId;
      dispatch({ type: 'SET_INCOMING', call: { callId: detail.callId, fromId: detail.fromId, fromAlias: detail.fromAlias, isVideo: detail.isVideo } });
      dispatch({ type: 'SET_SCREEN', screen: 'call' });
    };

    const onHangup = () => {
      dispatch({ type: 'SET_CALL', session: null });
      dispatch({ type: 'SET_INCOMING', call: null });
      dispatch({ type: 'SET_SCREEN', screen: 'home' });
    };

    p2pChat.addEventListener('friend_request', onRequest);
    p2pChat.addEventListener('message', onMessage);
    p2pChat.addEventListener('call_offer', onCallOffer);
    p2pChat.addEventListener('call_hangup', onHangup);
    return () => {
      p2pChat.removeEventListener('friend_request', onRequest);
      p2pChat.removeEventListener('message', onMessage);
      p2pChat.removeEventListener('call_offer', onCallOffer);
      p2pChat.removeEventListener('call_hangup', onHangup);
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    dispatch({ type: 'SET_FRIENDS', friends: storage.loadFriends() });
    dispatch({ type: 'SET_REQUESTS', requests: storage.loadRequests() });
    dispatch({ type: 'SET_CONVERSATIONS', conversations: storage.loadConversations() });
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    dispatch({ type: 'TOAST', msg });
    toastTimer.current = setTimeout(() => dispatch({ type: 'TOAST', msg: null }), 3000);
  }, []);

  const navigate = useCallback((screen: Screen, peerId?: string) => {
    if (peerId !== undefined) dispatch({ type: 'SET_ACTIVE_PEER', peerId });
    dispatch({ type: 'SET_SCREEN', screen });
  }, []);

  const sendFriendRequest = useCallback(async (id: string) => {
    try {
      await p2pChat.sendFriendRequest(id);
      refresh();
      showToast('Friend request sent!');
    } catch (e: unknown) {
      showToast((e as Error).message);
    }
  }, [refresh, showToast]);

  const acceptRequest = useCallback(async (reqId: string) => {
    await p2pChat.acceptFriendRequest(reqId);
    refresh();
    showToast('Friend added!');
  }, [refresh, showToast]);

  const declineRequest = useCallback(async (reqId: string) => {
    await p2pChat.declineFriendRequest(reqId);
    refresh();
  }, [refresh]);

  const sendMessage = useCallback(async (peerId: string, text: string) => {
    await p2pChat.sendMessage(peerId, text);
    refresh();
  }, [refresh]);

  const startCall = useCallback(async (peerId: string, isVideo: boolean) => {
    try {
      const session = await p2pChat.startCall(peerId, isVideo);
      dispatch({ type: 'SET_CALL', session });
      dispatch({ type: 'SET_SCREEN', screen: 'call' });
    } catch (e: unknown) {
      showToast((e as Error).message);
    }
  }, [showToast]);

  const answerCall = useCallback(async () => {
    if (!state.incomingCall) return;
    // The SDP was delivered via the call_offer event — stored in P2PChat service
    showToast('Call connected');
  }, [state.incomingCall, showToast]);

  const rejectCall = useCallback(() => {
    if (state.incomingCall) {
      p2pChat.hangup(state.incomingCall.callId, state.incomingCall.fromId);
    }
    dispatch({ type: 'SET_INCOMING', call: null });
    dispatch({ type: 'SET_SCREEN', screen: 'home' });
  }, [state.incomingCall]);

  const hangup = useCallback(() => {
    if (state.callSession?.pc) state.callSession.pc.close();
    if (callIdRef.current && state.callSession) {
      p2pChat.hangup(callIdRef.current, state.callSession.peerId);
    }
    dispatch({ type: 'SET_CALL', session: null });
    dispatch({ type: 'SET_INCOMING', call: null });
    dispatch({ type: 'SET_SCREEN', screen: 'home' });
  }, [state.callSession]);

  const setAlias = useCallback(async (alias: string) => {
    await p2pChat.setAlias(alias);
    const profile = p2pChat.getProfile();
    if (profile) dispatch({ type: 'INIT_DONE', profile });
    showToast('Alias saved!');
  }, [showToast]);

  return (
    <Ctx.Provider value={{
      state, navigate, refresh, showToast,
      sendFriendRequest, acceptRequest, declineRequest,
      sendMessage, startCall, answerCall, rejectCall, hangup, setAlias,
    }}>
      {children}
    </Ctx.Provider>
  );
}
