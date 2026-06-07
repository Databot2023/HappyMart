/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/OnboardingScreen.tsx
───────────────────────────────────────────────────────────────────────────── */
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export function OnboardingScreen() {
  const { state, setAlias, navigate } = useApp();
  const [alias, setAliasInput] = useState('');
  const [step, setStep] = useState<'welcome' | 'alias'>('welcome');

  const profile = state.profile;

  const handleContinue = async () => {
    if (alias.trim()) {
      await setAlias(alias.trim());
    }
    navigate('home');
  };

  if (!profile) return null;

  return (
    <div className="screen onboarding">
      <div className="onboarding-blob blob1" />
      <div className="onboarding-blob blob2" />

      <div className="onboarding-content">
        {step === 'welcome' ? (
          <>
            <div className="ob-icon">
              <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="url(#og1)" />
                <path d="M18 32c0-7.73 6.27-14 14-14s14 6.27 14 14-6.27 14-14 14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <circle cx="32" cy="32" r="5" fill="#fff" />
                <defs>
                  <radialGradient id="og1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) rotate(90) scale(32)">
                    <stop stopColor="#7c3aed" />
                    <stop offset="1" stopColor="#4f46e5" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
            <h1 className="ob-title">Welcome to<br /><span className="gradient-text">KeetChat</span></h1>
            <p className="ob-body">
              True peer-to-peer messaging and calling. No servers store your messages.
              No one can read your conversations.
            </p>

            <div className="id-card">
              <span className="id-label">Your Device ID</span>
              <span className="id-value">{profile.numericId}</span>
              <span className="id-hint">Share this ID to receive friend requests</span>
            </div>

            <button className="btn-primary" onClick={() => setStep('alias')}>
              Set Up Profile →
            </button>
            <button className="btn-ghost" onClick={() => navigate('home')}>
              Skip for now
            </button>
          </>
        ) : (
          <>
            <button className="back-btn" onClick={() => setStep('welcome')}>
              ← Back
            </button>
            <h2 className="ob-title" style={{ fontSize: '1.6rem' }}>Choose Your<br /><span className="gradient-text">Alias</span></h2>
            <p className="ob-body">
              An alias lets friends find you more easily. It will show as <strong>alias@keet</strong>
            </p>
            <div className="input-group">
              <input
                id="alias-input"
                className="text-input"
                type="text"
                placeholder="yourname"
                value={alias}
                onChange={e => setAliasInput(e.target.value)}
                maxLength={32}
                autoFocus
              />
              <span className="input-suffix">@keet</span>
            </div>
            <button className="btn-primary" onClick={handleContinue}>
              Get Started 🚀
            </button>
          </>
        )}
      </div>
    </div>
  );
}
