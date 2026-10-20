'use client';

/**
 * The single brand moment: a 9.5 s logo clip that plays once per visit (per browser tab
 * session). The poster is the logo itself and is what most visits see. The clip is never
 * fetched when the reader prefers reduced motion or has asked to save data; it can still be
 * played on request, and paused at any time (WCAG 2.2.2).
 */
import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'am-intro-seen';
type State = 'idle' | 'playing' | 'paused' | 'ended';

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

export function IntroClip() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [load, setLoad] = useState(false);
  const [small, setSmall] = useState(false);
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    setMounted(true);
    setSmall(window.innerWidth < 700);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* storage unavailable: treat as first visit */
    }
    const replay = new URLSearchParams(window.location.search).get('intro') === 'replay';
    if ((replay || !seen) && !reduce && !saveData) {
      markSeen();
      setLoad(true);
      setState('playing');
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !load) return;
    if (state === 'playing') {
      const p = v.play();
      if (p) p.catch(() => setState('idle'));
    } else if (state === 'paused') {
      v.pause();
    }
  }, [state, load]);

  const onControl = () => {
    if (state === 'playing') return setState('paused');
    if (state === 'paused') return setState('playing');
    const v = videoRef.current;
    if (v) {
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
    setLoad(true);
    setState('playing');
  };

  const label = state === 'playing' ? 'Pause intro' : state === 'paused' ? 'Resume intro' : state === 'ended' ? 'Replay intro' : 'Play intro';
  const size = small ? '800' : '1600';

  return (
    <div className={`am-stage-wrap${state === 'playing' ? ' is-playing' : ''}`}>
      <div className={`am-stage${state === 'playing' || state === 'paused' ? ' is-playing' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- LCP poster, served as-is */}
        <img src="/brand/intro/poster-1600.webp" alt="AbrahamMoses" width={1600} height={400} fetchPriority="high" decoding="async" />
        {load ? (
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            poster="/brand/intro/poster-1600.webp"
            onPlay={markSeen}
            onEnded={() => setState('ended')}
          >
            <source src={`/brand/intro/intro-${size}.webm`} type="video/webm" />
            <source src={`/brand/intro/intro-${size}.mp4`} type="video/mp4" />
          </video>
        ) : null}
      </div>
      {mounted ? (
        <button type="button" className="am-intro-ctl" onClick={onControl}>
          {label}
        </button>
      ) : null}
    </div>
  );
}
