import React, { useEffect, useRef, useState } from 'react';

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          width?: string | number;
          height?: string | number;
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void;
            onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
            onError?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerProps {
  videoIds: string[];
  isPlaying: boolean;
  isMuted: boolean;
  seekTrigger: { time: number; seq: number } | null;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number, duration: number) => void;
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoIds,
  isPlaying,
  isMuted,
  seekTrigger,
  onPlayStateChange,
  onTimeUpdate,
}) => {
  const [idx, setIdx] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const readyRef = useRef(false);

  const isPlayingRef = useRef(isPlaying);
  const isMutedRef = useRef(isMuted);
  const onPlayStateRef = useRef(onPlayStateChange);
  const onTimeRef = useRef(onTimeUpdate);

  isPlayingRef.current = isPlaying;
  isMutedRef.current = isMuted;
  onPlayStateRef.current = onPlayStateChange;
  onTimeRef.current = onTimeUpdate;

  useEffect(() => {
    setIdx(0);
  }, [videoIds]);

  const currentVideoId = videoIds[idx];

  useEffect(() => {
    if (!currentVideoId) return;
    let destroyed = false;
    readyRef.current = false;

    loadYouTubeApi().then(() => {
      if (destroyed || !hostRef.current || !window.YT?.Player) return;
      hostRef.current.innerHTML = '';
      const mount = document.createElement('div');
      hostRef.current.appendChild(mount);

      playerRef.current = new window.YT.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: currentVideoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            if (destroyed) return;
            readyRef.current = true;
            const dur = e.target.getDuration();
            if (dur > 0) onTimeRef.current(0, dur);
            if (isMutedRef.current) e.target.mute();
            if (isPlayingRef.current) e.target.playVideo();
          },
          onStateChange: (e) => {
            if (destroyed) return;
            const playing = e.data === 1;
            onPlayStateRef.current(playing);
            if (e.data === 0) {
              onTimeRef.current(0, e.target.getDuration());
            }
          },
          onError: () => {
            if (destroyed) return;
            // Automatically try the next embeddable YouTube video candidate
            setIdx((prev) => (prev + 1 < videoIds.length ? prev + 1 : prev));
          },
        },
      });
    });

    return () => {
      destroyed = true;
      readyRef.current = false;
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
    };
  }, [currentVideoId, videoIds.length]);

  // Sync play/pause
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      const state = p.getPlayerState();
      if (isPlaying && state !== 1) p.playVideo();
      else if (!isPlaying && state === 1) p.pauseVideo();
    } catch {}
  }, [isPlaying]);

  // Sync mute
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      if (isMuted) p.mute();
      else p.unMute();
    } catch {}
  }, [isMuted]);

  // Sync seek
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current || !seekTrigger) return;
    try {
      p.seekTo(seekTrigger.time, true);
    } catch {}
  }, [seekTrigger]);

  // Poll exact YouTube playback time every 150ms for tight lyric sync
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      try {
        if (p.getPlayerState() === 1) {
          const t = p.getCurrentTime();
          const d = p.getDuration();
          onTimeRef.current(t, d);
        }
      } catch {}
    }, 150);
    return () => clearInterval(id);
  }, []);

  return <div ref={hostRef} className="youtube-embed-frame" />;
};
