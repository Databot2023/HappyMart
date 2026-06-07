/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/HomeScreen.tsx  –  Friends list & conversations
───────────────────────────────────────────────────────────────────────────── */
import React from 'react';
import { useApp } from '../context/AppContext';
import type { Friend, Conversation } from '../types';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function avatar(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(id: string): string {
  const colors = [
    '#7c3aed','#4f46e5','#0891b2','#059669','#d97706',
    '#dc2626','#db2777','#7c3aed','#6d28d9','#1d4ed8',
  ];
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}

export function HomeScreen() {
  const { state, navigate } = useApp();
  const { conversations, friends, requests, profile } = state;

  const pendingCount = requests.filter(r =>
    r.status === 'pending' && r.toId === profile?.numericId
  ).length;

  // Map convs with friend info
  const convList = conversations
    .slice()
    .sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));

  const friendsWithNoConv = friends.filter(
    f => !conversations.find(c => c.peerId === f.numericId)
  );

  return (
    <div className="screen home">
      {/* Header */}
      <header className="home-header">
        <div className="home-header-left">
          <div
            className="my-avatar"
            style={{ background: avatarColor(profile?.numericId ?? 'x') }}
            onClick={() => navigate('settings')}
          >
            {avatar(profile?.alias ?? profile?.numericId ?? '??')}
          </div>
          <div>
            <h1 className="home-title">KeetChat</h1>
            <p className="home-sub">{profile?.alias ?? profile?.numericId}</p>
          </div>
        </div>
        <div className="home-header-right">
          {pendingCount > 0 && (
            <button
              id="btn-requests"
              className="icon-btn notif-btn"
              onClick={() => navigate('friendRequests')}
            >
              <BellIcon />
              <span className="badge">{pendingCount}</span>
            </button>
          )}
          <button id="btn-add-friend" className="icon-btn" onClick={() => navigate('addFriend')}>
            <AddUserIcon />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="home-body">
        {convList.length === 0 && friends.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h2>No conversations yet</h2>
            <p>Add a friend using their 10-digit ID to start chatting</p>
            <button className="btn-primary" onClick={() => navigate('addFriend')}>
              Add Friend
            </button>
          </div>
        ) : (
          <>
            {/* Active conversations */}
            {convList.length > 0 && (
              <section className="section">
                <h3 className="section-title">Messages</h3>
                {convList.map(conv => (
                  <ConvItem key={conv.peerId} conv={conv} onClick={() => navigate('chat', conv.peerId)} />
                ))}
              </section>
            )}

            {/* Friends without conversations */}
            {friendsWithNoConv.length > 0 && (
              <section className="section">
                <h3 className="section-title">Friends</h3>
                {friendsWithNoConv.map(f => (
                  <FriendItem key={f.numericId} friend={f} onClick={() => navigate('chat', f.numericId)} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConvItem({ conv, onClick }: { conv: Conversation; onClick: () => void }) {
  const name = conv.peerAlias ?? conv.peerId;
  return (
    <button className="conv-item" onClick={onClick} id={`conv-${conv.peerId.replace(/\s/g,'')}`}>
      <div className="av" style={{ background: avatarColor(conv.peerId) }}>
        {avatar(name)}
        <span className={`status-dot ${conv.unreadCount > 0 ? 'online' : 'offline'}`} />
      </div>
      <div className="conv-info">
        <span className="conv-name">{name}</span>
        <span className="conv-preview">{conv.lastMessage?.text ?? 'No messages yet'}</span>
      </div>
      <div className="conv-meta">
        {conv.lastMessage && <span className="conv-time">{timeAgo(conv.lastMessage.timestamp)}</span>}
        {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
      </div>
    </button>
  );
}

function FriendItem({ friend, onClick }: { friend: Friend; onClick: () => void }) {
  const name = friend.alias ?? friend.numericId;
  return (
    <button className="conv-item" onClick={onClick} id={`friend-${friend.numericId.replace(/\s/g,'')}`}>
      <div className="av" style={{ background: avatarColor(friend.numericId) }}>
        {avatar(name)}
        <span className={`status-dot ${friend.online ? 'online' : 'offline'}`} />
      </div>
      <div className="conv-info">
        <span className="conv-name">{name}</span>
        <span className="conv-preview">Tap to start chatting</span>
      </div>
    </button>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function AddUserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  );
}
