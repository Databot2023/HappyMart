/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/ChatScreen.tsx  –  P2P encrypted 1:1 messaging + call buttons
───────────────────────────────────────────────────────────────────────────── */
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as storage from '../services/storage';
import type { Message } from '../types';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function avatar(name: string, bg: string) {
  const colors: Record<string, string> = {};
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="av-sm" style={{ background: bg }}>
      {initials}
    </div>
  );
}

const PALETTE = ['#7c3aed','#4f46e5','#0891b2','#059669','#d97706','#dc2626','#db2777'];
function peerColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

export function ChatScreen() {
  const { state, navigate, sendMessage, startCall } = useApp();
  const { activePeerId, friends, profile } = state;
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const friend = friends.find(f => f.numericId === activePeerId);
  const peerName = friend?.alias ?? activePeerId ?? 'Unknown';
  const color = peerColor(activePeerId ?? '');

  // Load messages
  useEffect(() => {
    if (!activePeerId) return;
    const convs = storage.loadConversations();
    const conv = convs.find(c => c.peerId === activePeerId);
    setMessages(conv?.messages ?? []);
    storage.markRead(activePeerId);
  }, [activePeerId, state.conversations]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !activePeerId) return;
    const t = text.trim();
    setText('');
    try {
      await sendMessage(activePeerId, t);
    } catch (e: unknown) {
      console.error(e);
    }
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activePeerId) {
    navigate('home');
    return null;
  }

  return (
    <div className="screen chat-screen">
      {/* Header */}
      <header className="chat-header">
        <button className="back-btn" id="btn-chat-back" onClick={() => navigate('home')}>
          ←
        </button>
        <div className="av" style={{ background: color, width: 38, height: 38, borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.9rem', color:'#fff', flexShrink:0 }}>
          {peerName.slice(0, 2).toUpperCase()}
        </div>
        <div className="chat-peer-info">
          <span className="chat-peer-name">{peerName}</span>
          <span className="chat-peer-id">{activePeerId}</span>
        </div>
        <div className="chat-actions">
          <button
            id="btn-voice-call"
            className="icon-btn"
            onClick={() => startCall(activePeerId, false)}
            title="Voice call"
          >
            <PhoneIcon />
          </button>
          <button
            id="btn-video-call"
            className="icon-btn"
            onClick={() => startCall(activePeerId, true)}
            title="Video call"
          >
            <VideoIcon />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div style={{ fontSize: '2.5rem' }}>🔐</div>
            <p>End-to-end encrypted</p>
            <p className="hint">Messages go directly to {peerName}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} isMe={msg.isLocal} myColor={color} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          id="msg-input"
          className="msg-textarea"
          placeholder="Message…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <button
          id="btn-send"
          className={`send-btn ${text.trim() ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!text.trim()}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isMe, myColor }: { msg: Message; isMe: boolean; myColor: string }) {
  return (
    <div className={`bubble-row ${isMe ? 'me' : 'them'}`}>
      <div className={`bubble ${isMe ? 'bubble-me' : 'bubble-them'}`}>
        <p className="bubble-text">{msg.text}</p>
        <span className="bubble-time">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
