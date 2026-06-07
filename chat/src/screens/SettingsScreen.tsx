/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/SettingsScreen.tsx
───────────────────────────────────────────────────────────────────────────── */
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export function SettingsScreen() {
  const { state, navigate, setAlias, showToast } = useApp();
  const { profile } = state;
  const [alias, setAliasVal] = useState(
    profile?.alias?.replace('@keet', '') ?? ''
  );
  const [relay, setRelay] = useState(
    localStorage.getItem('keet_relay_url') ?? ''
  );

  const saveAlias = async () => {
    if (!alias.trim()) return;
    await setAlias(alias.trim());
  };

  const saveRelay = () => {
    if (relay.trim()) {
      localStorage.setItem('keet_relay_url', relay.trim());
    } else {
      localStorage.removeItem('keet_relay_url');
    }
    showToast('Relay URL saved. Restart app to apply.');
  };

  const copyId = () => {
    if (profile) navigator.clipboard?.writeText(profile.numericId).catch(() => {});
    showToast('ID copied!');
  };

  const clearData = () => {
    if (confirm('Clear ALL local data? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="screen settings-screen">
      <header className="simple-header">
        <button className="back-btn" id="btn-back-settings" onClick={() => navigate('home')}>←</button>
        <h2>Settings</h2>
      </header>

      <div className="settings-body">
        {/* Identity */}
        <section className="settings-section">
          <h3 className="settings-section-title">Identity</h3>

          <div className="settings-row">
            <label>Device ID</label>
            <div className="settings-value-row">
              <span className="mono-val">{profile?.numericId}</span>
              <button id="btn-copy-myid" className="btn-outline-xs" onClick={copyId}>Copy</button>
            </div>
          </div>

          <div className="settings-row">
            <label htmlFor="set-alias">Alias</label>
            <div className="settings-input-row">
              <input
                id="set-alias"
                className="text-input sm-input"
                type="text"
                placeholder="yourname"
                value={alias}
                onChange={e => setAliasVal(e.target.value)}
                maxLength={32}
              />
              <span className="input-suffix-sm">@keet</span>
              <button id="btn-save-alias" className="btn-outline-xs" onClick={saveAlias}>Save</button>
            </div>
          </div>
        </section>

        {/* Network */}
        <section className="settings-section">
          <h3 className="settings-section-title">Network</h3>
          <p className="settings-desc">
            Optional: Set a relay WebSocket URL for NAT traversal when direct P2P is unavailable.
          </p>
          <div className="settings-row">
            <label htmlFor="set-relay">Relay URL</label>
            <div className="settings-input-row">
              <input
                id="set-relay"
                className="text-input sm-input"
                type="url"
                placeholder="ws://your-server:3001"
                value={relay}
                onChange={e => setRelay(e.target.value)}
              />
              <button id="btn-save-relay" className="btn-outline-xs" onClick={saveRelay}>Save</button>
            </div>
          </div>
          <div className="info-box mt-sm">
            <p>🌐 STUN: stun.l.google.com:19302</p>
            <p>🔁 TURN: openrelay.metered.ca (free fallback)</p>
          </div>
        </section>

        {/* About */}
        <section className="settings-section">
          <h3 className="settings-section-title">About</h3>
          <div className="settings-row">
            <label>Version</label>
            <span className="settings-val-right">1.0.0</span>
          </div>
          <div className="settings-row">
            <label>Stack</label>
            <span className="settings-val-right">Hyperswarm + WebRTC</span>
          </div>
          <div className="settings-row">
            <label>Encryption</label>
            <span className="settings-val-right">E2E (P-256 ECDH)</span>
          </div>
        </section>

        {/* Danger */}
        <section className="settings-section danger-section">
          <h3 className="settings-section-title danger-title">Danger Zone</h3>
          <button id="btn-clear-data" className="btn-danger" onClick={clearData}>
            🗑 Clear All Local Data
          </button>
        </section>
      </div>
    </div>
  );
}
