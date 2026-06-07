/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/SplashScreen.tsx
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect } from 'react';

export function SplashScreen() {
  return (
    <div className="splash">
      <div className="splash-logo">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="32" fill="url(#g1)" />
          <path d="M18 32c0-7.73 6.27-14 14-14s14 6.27 14 14-6.27 14-14 14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="32" r="5" fill="#fff" />
          <defs>
            <radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) rotate(90) scale(32)">
              <stop stopColor="#7c3aed" />
              <stop offset="1" stopColor="#4f46e5" />
            </radialGradient>
          </defs>
        </svg>
        <h1 className="splash-title">KeetChat</h1>
        <p className="splash-sub">Encrypted · Peer-to-Peer · Private</p>
      </div>
      <div className="splash-spinner">
        <div className="spinner" />
      </div>
    </div>
  );
}
