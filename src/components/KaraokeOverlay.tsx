import React, { useEffect, useState } from 'react';
import { Mic2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { LyricLine, Song } from '../types/music';
import { fetchRealLyrics, translateAllLines } from '../utils/lyricsApi';

interface KaraokeOverlayProps {
  song: Song;
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onChangeSpeed: (speed: number) => void;
  onClose: () => void;
}

export const KaraokeOverlay: React.FC<KaraokeOverlayProps> = ({
  song,
  currentTime,
  isPlaying,
  speed,
  onTogglePlay,
  onSeek,
  onChangeSpeed,
  onClose,
}) => {
  const [lines, setLines] = useState<LyricLine[]>(song.lines);

  useEffect(() => {
    if (song.lines && song.lines.length > 0) {
      setLines(song.lines);
      return;
    }
    let cancelled = false;
    fetchRealLyrics(song.id, song.title, song.artistName, song.chordProgression).then((res) => {
      if (cancelled || res.lines.length === 0) return;
      setLines(res.lines);
      translateAllLines(song.id, res.lines, song.language, 'pt-BR').then(({ lines: translated }) => {
        if (!cancelled) setLines(translated);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [song]);

  const playableLines = lines.filter((l) => !l.isSection);
  let activeIdx = -1;
  for (let i = 0; i < playableLines.length; i++) {
    if (currentTime >= playableLines[i].time) activeIdx = i;
  }

  const prevLine = activeIdx > 0 ? playableLines[activeIdx - 1] : null;
  const activeLine = activeIdx >= 0 ? playableLines[activeIdx] : playableLines[0];
  const nextLine = activeIdx + 1 < playableLines.length ? playableLines[activeIdx + 1] : null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="karaoke-overlay"
      style={{
        background: `radial-gradient(circle at 50% 25%, ${song.accentColor}33 0%, #09090B 72%)`,
      }}
    >
      <div className="karaoke-topbar">
        <div className="karaoke-meta">
          <Mic2 size={18} style={{ color: song.accentColor }} />
          <span>MODO KARAOKÊ • {song.title}</span>
          <span className="karaoke-artist">— {song.artistName}</span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} title="Sair do Karaokê">
          <X size={22} />
        </button>
      </div>

      <div className="karaoke-stage">
        {prevLine && <p className="karaoke-line prev">{prevLine.text}</p>}

        {activeLine && (
          <div className="karaoke-active-wrap">
            <p className="karaoke-line active" style={{ textShadow: `0 0 38px ${song.accentColor}66` }}>
              {activeLine.text}
            </p>
            {activeLine.translation && song.language !== 'pt' && (
              <p className="karaoke-trans">{activeLine.translation}</p>
            )}
          </div>
        )}

        {nextLine && <p className="karaoke-line next">{nextLine.text}</p>}
      </div>

      <div className="karaoke-controls">
        <div className="karaoke-progress-row">
          <span className="mono-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={song.duration}
            step={0.5}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="karaoke-slider"
          />
          <span className="mono-time">{formatTime(song.duration)}</span>
        </div>

        <div className="karaoke-buttons-row">
          <button type="button" className="ghost-btn" onClick={() => onSeek(0)} title="Reiniciar">
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            className="karaoke-play-btn"
            style={{ backgroundColor: song.accentColor }}
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <div className="speed-pills">
            {[0.75, 1, 1.25].map((s) => (
              <button
                type="button"
                key={s}
                className={`speed-pill ${speed === s ? 'active' : ''}`}
                onClick={() => onChangeSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
