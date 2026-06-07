/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/AddFriendScreen.tsx
───────────────────────────────────────────────────────────────────────────── */
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

function formatId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)} ${digits.slice(3)}`;
  return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
}

export function AddFriendScreen() {
  const { navigate, sendFriendRequest, state } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const digits = input.replace(/\D/g, '');
  const valid = digits.length === 10 && digits !== state.profile?.numericId?.replace(/\D/g,'');

  const handleAdd = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await sendFriendRequest(formatId(input));
      navigate('home');
    } finally {
      setLoading(false);
    }
  };

  // Copy own ID
  const copyOwnId = () => {
    if (state.profile) {
      navigator.clipboard?.writeText(state.profile.numericId).catch(() => {});
    }
  };

  return (
    <div className="screen add-friend-screen">
      <header className="simple-header">
        <button className="back-btn" id="btn-back-add" onClick={() => navigate('home')}>←</button>
        <h2>Add Friend</h2>
      </header>

      <div className="add-friend-body">
        {/* Own ID section */}
        <div className="own-id-card">
          <p className="card-label">Your ID — share with friends</p>
          <p className="own-id-value">{state.profile?.numericId}</p>
          {state.profile?.alias && (
            <p className="own-alias">{state.profile.alias}</p>
          )}
          <button id="btn-copy-id" className="btn-outline-sm" onClick={copyOwnId}>
            📋 Copy ID
          </button>
        </div>

        <div className="divider-row"><span>OR</span></div>

        {/* Enter friend ID */}
        <div className="add-section">
          <label className="field-label" htmlFor="friend-id-input">
            Enter Friend's 10-Digit ID
          </label>
          <input
            id="friend-id-input"
            className="text-input big-input"
            type="tel"
            inputMode="numeric"
            placeholder="XXX XXX XXXX"
            value={input}
            onChange={e => setInput(formatId(e.target.value))}
            maxLength={12}
            autoFocus
          />
          {input && digits.length < 10 && (
            <p className="field-hint">{10 - digits.length} more digits needed</p>
          )}
          {input && digits === state.profile?.numericId?.replace(/\D/g,'') && (
            <p className="field-hint error">That's your own ID!</p>
          )}

          <button
            id="btn-send-request"
            className={`btn-primary ${valid && !loading ? '' : 'disabled'}`}
            onClick={handleAdd}
            disabled={!valid || loading}
          >
            {loading ? <span className="spinner-sm" /> : '🤝 Send Friend Request'}
          </button>
        </div>

        <div className="info-box">
          <p>💡 The request will be delivered directly to their device when they're online via the DHT network.</p>
        </div>
      </div>
    </div>
  );
}
