/* ─────────────────────────────────────────────────────────────────────────────
   src/screens/CallScreen.tsx  –  WebRTC Voice + Video Call UI
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

const PALETTE = ['#7c3aed','#4f46e5','#0891b2','#059669','#d97706','#dc2626','#db2777'];
function peerColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function useTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const iv = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [active]);
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function CallScreen() {
  const { state, answerCall, rejectCall, hangup } = useApp();
  const { callSession, incomingCall } = state;
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);

  const isIncoming = !!incomingCall && !callSession;
  const isVideo = callSession?.isVideo ?? incomingCall?.isVideo ?? false;
  const peerName = callSession?.peerAlias ?? callSession?.peerId
                ?? incomingCall?.fromAlias ?? incomingCall?.fromId ?? 'Unknown';
  const callState = callSession?.state ?? (isIncoming ? 'incoming' : 'idle');
  const color = peerColor(callSession?.peerId ?? incomingCall?.fromId ?? '');
  const timer = useTimer(callState === 'active');

  // Attach media streams to video elements
  useEffect(() => {
    if (callSession?.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = callSession.localStream;
    }
    if (callSession?.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = callSession.remoteStream;
    }
  }, [callSession]);

  const toggleMute = () => {
    callSession?.localStream?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleCam = () => {
    callSession?.localStream?.getVideoTracks().forEach(t => { t.enabled = camOff; });
    setCamOff(c => !c);
  };

  return (
    <div className="screen call-screen">
      {/* Background video (remote) */}
      {isVideo && callState === 'active' ? (
        <video
          ref={remoteVideoRef}
          className="remote-video"
          autoPlay
          playsInline
        />
      ) : (
        <div className="call-bg" style={{ background: `radial-gradient(ellipse at 50% 30%, ${color}44, #0a0a0f)` }} />
      )}

      {/* Caller info */}
      <div className="call-info">
        <div className="call-avatar" style={{ background: color }}>
          {peerName.slice(0, 2).toUpperCase()}
        </div>
        <h2 className="call-peer-name">{peerName}</h2>
        <p className="call-status">
          {isIncoming ? (isVideo ? '📹 Incoming video call…' : '📞 Incoming call…')
           : callState === 'outgoing' ? 'Calling…'
           : callState === 'active' ? timer
           : 'Call ended'}
        </p>
      </div>

      {/* Local preview (PiP) */}
      {isVideo && callState === 'active' && (
        <video
          ref={localVideoRef}
          className="local-video-pip"
          autoPlay
          muted
          playsInline
        />
      )}

      {/* Controls */}
      <div className="call-controls">
        {isIncoming ? (
          <>
            <button id="btn-reject-call" className="call-btn decline" onClick={rejectCall}>
              <EndCallIcon />
            </button>
            <button id="btn-answer-call" className="call-btn accept" onClick={answerCall}>
              <PhoneIcon />
            </button>
          </>
        ) : (
          <>
            <button
              id="btn-toggle-mute"
              className={`call-btn control ${muted ? 'active-control' : ''}`}
              onClick={toggleMute}
            >
              {muted ? <MutedIcon /> : <MicIcon />}
            </button>

            {isVideo && (
              <button
                id="btn-toggle-cam"
                className={`call-btn control ${camOff ? 'active-control' : ''}`}
                onClick={toggleCam}
              >
                {camOff ? <CamOffIcon /> : <CamIcon />}
              </button>
            )}

            <button
              id="btn-toggle-speaker"
              className={`call-btn control ${speakerOff ? 'active-control' : ''}`}
              onClick={() => setSpeakerOff(s => !s)}
            >
              {speakerOff ? <SpeakerOffIcon /> : <SpeakerIcon />}
            </button>

            <button id="btn-hangup" className="call-btn decline" onClick={hangup}>
              <EndCallIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const PhoneIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
  </svg>
);

const EndCallIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
    <path d="M17.4 13.2c-1.4-2.8-3.8-5.1-6.6-6.6L8.6 8.8c-.3.3-.7.4-1 .2C6.5 8.6 5.3 8.4 4 8.4c-.6 0-1-.4-1-1V4c0-.6.4-1 1-1C13.4 3 21 10.6 21 20c0 .6-.4 1-1 1h-3.5c-.6 0-1-.4-1-1 0-1.3-.2-2.5-.6-3.6-.1-.3 0-.7.2-1l2.3-2.2z" transform="rotate(135 12 12)"/>
  </svg>
);

const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const MutedIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const CamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const CamOffIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const SpeakerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const SpeakerOffIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);
