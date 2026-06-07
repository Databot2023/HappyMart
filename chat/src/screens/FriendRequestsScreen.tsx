/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/FriendRequestsScreen.tsx
───────────────────────────────────────────────────────────────────────────── */
import React from 'react';
import { useApp } from '../context/AppContext';
import type { FriendRequest } from '../types';

const PALETTE = ['#7c3aed','#4f46e5','#0891b2','#059669','#d97706','#dc2626','#db2777'];
function peerColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

export function FriendRequestsScreen() {
  const { state, navigate, acceptRequest, declineRequest } = useApp();
  const { requests, profile } = state;

  const pending = requests.filter(r => r.status === 'pending' && r.toId === profile?.numericId);
  const sent    = requests.filter(r => r.status === 'pending' && r.fromId === profile?.numericId);

  return (
    <div className="screen requests-screen">
      <header className="simple-header">
        <button className="back-btn" id="btn-back-req" onClick={() => navigate('home')}>←</button>
        <h2>Friend Requests</h2>
      </header>

      <div className="requests-body">
        {/* Incoming */}
        <section className="section">
          <h3 className="section-title">Incoming ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="empty-hint">No incoming requests</p>
          ) : pending.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              onAccept={() => acceptRequest(req.id)}
              onDecline={() => declineRequest(req.id)}
            />
          ))}
        </section>

        {/* Sent */}
        {sent.length > 0 && (
          <section className="section">
            <h3 className="section-title">Sent ({sent.length})</h3>
            {sent.map(req => (
              <div key={req.id} className="request-card sent-card">
                <div className="av" style={{ background: peerColor(req.toId), width:42,height:42,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#fff',flexShrink:0 }}>
                  {req.toId.slice(0,2)}
                </div>
                <div className="req-info">
                  <span className="req-name">{req.toId}</span>
                  <span className="req-status pending">Pending…</span>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function RequestCard({ req, onAccept, onDecline }: {
  req: FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = req.fromAlias ?? req.fromId;
  return (
    <div className="request-card" id={`req-${req.id.slice(0,8)}`}>
      <div className="av" style={{ background: peerColor(req.fromId), width:42,height:42,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#fff',flexShrink:0 }}>
        {name.slice(0,2).toUpperCase()}
      </div>
      <div className="req-info">
        <span className="req-name">{name}</span>
        <span className="req-id">{req.fromId}</span>
      </div>
      <div className="req-btns">
        <button
          className="req-btn decline-sm"
          id={`btn-decline-${req.id.slice(0,8)}`}
          onClick={onDecline}
        >✕</button>
        <button
          className="req-btn accept-sm"
          id={`btn-accept-${req.id.slice(0,8)}`}
          onClick={onAccept}
        >✓</button>
      </div>
    </div>
  );
}
