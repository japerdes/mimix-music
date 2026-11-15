import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns2,
  Copy,
  Disc3,
  ExternalLink,
  Guitar,
  Heart,
  Image as ImageIcon,
  Languages,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Mic2,
  Minimize2,
  Music,
  Pause,
  Play,
  Sliders,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LineAnnotation, LyricLine, Song } from '../types/music';
import { transposeChord } from '../utils/chords';
import { ChordDiagram } from './ChordDiagram';
import { CoverArt } from './CoverArt';
import { Visualizer } from './Visualizer';
import { fetchRealLyrics, TARGET_LANGUAGES, translateAllLines } from '../utils/lyricsApi';
import { ArtistBioData, fetchArtistDetails } from '../utils/artistApi';

export type SongDisplayMode = 'letra' | 'traducao' | 'idiomas' | 'cifra';
export type StudioTab = 'artista' | 'anotacoes' | 'acordes' | 'analise';

interface SongViewProps {
  song: Song;
  isFavorite: boolean;
  onToggleFavorite: (songId: string) => void;
  onSelectArtist: (artistId: string) => void;
  onBack: () => void;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  transpose: number;
  isMuted: boolean;
  volume: number;
  onChangeVolume: (v: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onChangeTranspose: (delta: number) => void;
  onResetTranspose: () => void;
  onToggleMute: () => void;
  onOpenKaraoke: () => void;
  onOpenCardStudio: (initialLineIds?: string[], resolvedLines?: LyricLine[]) => void;
  userAnnotations: Record<string, LineAnnotation>;
  onSaveAnnotation: (lineKey: string, annotation: LineAnnotation) => void;
  onDurationLoaded?: (songId: string, duration: number) => void;
}

export const SongView: React.FC<SongViewProps> = ({
  song,
  isFavorite,
  onToggleFavorite,
  onSelectArtist,
  onBack,
  isPlaying,
  isBuffering,
  currentTime,
  transpose,
  isMuted,
  volume,
  onChangeVolume,
  onTogglePlay,
  onSeek,
  onChangeTranspose,
  onResetTranspose,
  onToggleMute,
  onOpenKaraoke,
  onOpenCardStudio,
  userAnnotations,
  onSaveAnnotation,
  onDurationLoaded,
}) => {
  const [mode, setMode] = useState<SongDisplayMode>(song.language !== 'pt' ? 'traducao' : 'letra');
  const [studioTab, setStudioTab] = useState<StudioTab>('artista');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(() => {
    const firstAnnotated = song.lines.find((l) => l.annotation);
    return firstAnnotated ? firstAnnotated.id : song.lines.find((l) => !l.isSection)?.id || null;
  });
  const [selectedChord, setSelectedChord] = useState<string>(song.chordProgression[0] || 'C');
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(0);
  const [capo, setCapo] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(1.12);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [liveLines, setLiveLines] = useState<LyricLine[]>(song.lines);
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);
  const [translating, setTranslating] = useState<boolean>(false);
  const [transProgress, setTransProgress] = useState<{ done: number; total: number } | null>(null);
  const [targetLang, setTargetLang] = useState<string>('pt-BR');
  const [lyricsSource, setLyricsSource] = useState<'synced' | 'plain' | 'none' | 'local'>('local');
  const [artistBio, setArtistBio] = useState<ArtistBioData | null>(null);
  const [loadingArtist, setLoadingArtist] = useState<boolean>(false);
  const [translatedKey, setTranslatedKey] = useState<string>('');
  const [detectedLang, setDetectedLang] = useState<string>('');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [followSynced, setFollowSynced] = useState<boolean>(true);
  const [syncOffset, setSyncOffset] = useState<number>(0);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteBody, setNewNoteBody] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(song.language !== 'pt' ? 'traducao' : 'letra');
    setSelectedChord(song.chordProgression[0] || 'C');
    setShowNoteForm(false);
    setCapo(0);
    setTranslatedKey('');

    if (song.lines && song.lines.length > 0) {
      setLiveLines(song.lines);
      setLyricsSource('local');
      setLoadingLyrics(false);
      const firstAnnotated = song.lines.find((l) => l.annotation);
      setSelectedLineId(firstAnnotated ? firstAnnotated.id : song.lines.find((l) => !l.isSection)?.id || null);
    } else {
      let cancelled = false;
      setLiveLines([]);
      setLoadingLyrics(true);
      fetchRealLyrics(song.id, song.title, song.artistName, song.chordProgression).then((res) => {
        if (cancelled) return;
        setLoadingLyrics(false);
        setLyricsSource(res.source);
        if (res.lines.length > 0) {
          setLiveLines(res.lines);
          setSelectedLineId(res.lines[0].id);
          const lastTime = res.lines[res.lines.length - 1]?.time || 0;
          const fullDur = Math.max(res.duration || 0, Math.ceil(lastTime + 8));
          if (fullDur > 30 && onDurationLoaded) {
            onDurationLoaded(song.id, fullDur);
          }
        }
      });
      // Fetch artist bio in parallel
      setLoadingArtist(true);
      fetchArtistDetails(song.artistName).then((bio) => {
        if (!cancelled) {
          setArtistBio(bio);
          setLoadingArtist(false);
        }
      });
      setSyncOffset(0);
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    setLoadingArtist(true);
    fetchArtistDetails(song.artistName).then((bio) => {
      if (!cancelled) {
        setArtistBio(bio);
        setLoadingArtist(false);
      }
    });

    setSyncOffset(0);

    return () => {
      cancelled = true;
    };
  }, [song.id, onDurationLoaded]);

  // Auto-translate 100% of the song into the selected targetLang as soon as lyrics load
  useEffect(() => {
    if (loadingLyrics || liveLines.length === 0) return;
    const key = `${song.id}:${targetLang}:${liveLines.length}`;
    if (translatedKey === key) return;

    let cancelled = false;
    setTranslating(true);
    setTransProgress(null);
    translateAllLines(song.id, liveLines, song.language, targetLang, (done, total, partial, lang) => {
      if (cancelled) return;
      setTransProgress({ done, total });
      if (partial) setLiveLines(partial);
      if (lang && lang !== 'auto') setDetectedLang(lang);
    }).then(({ lines: translated, detectedLang: dl }) => {
      if (cancelled) return;
      setLiveLines(translated);
      if (dl && dl !== 'auto') setDetectedLang(dl);
      setTranslatedKey(key);
      setTranslating(false);
      setTransProgress(null);
    });
    return () => {
      cancelled = true;
    };
  }, [song.id, song.language, targetLang, loadingLyrics, liveLines.length, translatedKey]);

  useEffect(() => {
    if (autoScrollSpeed === 0) return;
    const id = window.setInterval(() => {
      window.scrollBy({ top: autoScrollSpeed * 1.4, behavior: 'auto' });
    }, 50);
    return () => clearInterval(id);
  }, [autoScrollSpeed]);

  const effectiveTranspose = transpose - capo;

  const activeLineId = useMemo(() => {
    if (!isPlaying && currentTime === 0) return null;
    const adjusted = currentTime + syncOffset;
    let active: string | null = null;
    for (const l of liveLines) {
      if (!l.isSection && adjusted >= l.time) {
        active = l.id;
      }
    }
    return active;
  }, [liveLines, currentTime, isPlaying, syncOffset]);

  // Auto-scroll active synced line into center of viewport when playing
  useEffect(() => {
    if (!followSynced || !isPlaying || !activeLineId) return;
    const el = document.getElementById(`lyric-line-${activeLineId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineId, followSynced, isPlaying]);

  // Optional TTS reader for full lyrics
  useEffect(() => {
    if (!ttsEnabled || !isPlaying || !activeLineId || !('speechSynthesis' in window)) return;
    const line = liveLines.find((l) => l.id === activeLineId);
    if (!line || line.isSection) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(line.text);
    const langMap: Record<string, string> = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES',
      ko: 'ko-KR',
      ja: 'ja-JP',
      fr: 'fr-FR',
      it: 'it-IT',
      de: 'de-DE',
    };
    utter.lang = langMap[song.language] || 'en-US';
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  }, [activeLineId, ttsEnabled, isPlaying, liveLines, song.language]);

  useEffect(() => {
    if (!ttsEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [ttsEnabled]);

  const uniqueChords = useMemo(() => {
    const set = new Set<string>();
    song.chordProgression.forEach((c) => set.add(transposeChord(c, effectiveTranspose)));
    liveLines.forEach((l) => {
      l.chords?.forEach((c) => set.add(transposeChord(c.chord, effectiveTranspose)));
    });
    return Array.from(set);
  }, [song, liveLines, effectiveTranspose]);

  const transposedKey = transposeChord(song.musicalKey, effectiveTranspose);

  const poeticStats = useMemo(() => {
    const textLines = liveLines.filter((l) => !l.isSection);
    const allWords = textLines
      .flatMap((l) => l.text.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/))
      .filter(Boolean);
    const uniqueWords = new Set(allWords);
    const lexicalRichness = allWords.length > 0 ? Math.round((uniqueWords.size / allWords.length) * 100) : 0;
    const avgWordsPerLine = textLines.length > 0 ? (allWords.length / textLines.length).toFixed(1) : '0';

    return {
      verses: textLines.length,
      totalWords: allWords.length,
      uniqueWords: uniqueWords.size,
      lexicalRichness,
      avgWordsPerLine,
    };
  }, [liveLines]);

  const selectedLine = liveLines.find((l) => l.id === selectedLineId) || null;
  const selectedLineAnnotation = selectedLine
    ? userAnnotations[`${song.id}:${selectedLine.id}`] || selectedLine.annotation
    : null;

  const handleCopyLyrics = () => {
    const text = liveLines
      .map((l) => (l.isSection ? `\n${l.text}` : l.text))
      .join('\n')
      .trim();
    navigator.clipboard.writeText(`${song.title} — ${song.artistName}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveUserNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLine || !newNoteBody.trim()) return;
    onSaveAnnotation(`${song.id}:${selectedLine.id}`, {
      author: 'Você (Comunidade)',
      title: newNoteTitle.trim() || 'Nota pessoal',
      body: newNoteBody.trim(),
      category: 'Comunidade',
      votes: 1,
    });
    setNewNoteTitle('');
    setNewNoteBody('');
    setShowNoteForm(false);
  };

  const renderChordLine = (line: LyricLine) => {
    if (!line.chords || line.chords.length === 0) return null;
    const sorted = [...line.chords].sort((a, b) => a.pos - b.pos);
    return (
      <div className="cifra-chords-row" aria-hidden="true">
        {sorted.map((mark, idx) => {
          const prevPos = idx === 0 ? 0 : sorted[idx - 1].pos + sorted[idx - 1].chord.length;
          const spaces = Math.max(1, mark.pos - prevPos);
          const chordLabel = transposeChord(mark.chord, effectiveTranspose);
          return (
            <React.Fragment key={`${line.id}-c-${idx}`}>
              <span>{'\u00A0'.repeat(idx === 0 ? mark.pos : spaces)}</span>
              <button
                type="button"
                className={`chord-pill ${selectedChord === chordLabel ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedChord(chordLabel);
                  setStudioTab('acordes');
                  setFocusMode(false);
                }}
              >
                {chordLabel}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="song-view">
      <div
        className="song-ambient-glow"
        style={{ background: `radial-gradient(ellipse at 25% 0%, ${song.accentColor}2A 0%, transparent 65%)` }}
      />

      <div className="song-topbar">
        <button type="button" className="back-pill" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Voltar ao Catálogo</span>
        </button>

        <div className="song-topbar-badges">
          <span className="meta-chip">#{song.rank} Em Alta</span>
          <span className="meta-chip mono">{song.bpm} BPM</span>
          <span className="meta-chip mono">
            Tom: {transposedKey} {capo > 0 && `(Capo ${capo}ª)`}
          </span>
        </div>
      </div>

      {/* Hero Header */}
      <header className="song-hero">
        <CoverArt
          src={song.coverImage}
          gradient={song.coverGradient}
          alt={song.title}
          className="song-cover-art"
        >
          <span className="cover-vinyl-ring" />
        </CoverArt>

        <div className="song-hero-info">
          <div className="song-genre-row">
            <span className="genre-tag" style={{ borderColor: `${song.accentColor}66`, color: song.accentColor }}>
              {song.genre}
            </span>
            <span className="song-views">{song.views} acessos</span>
          </div>

          <h1 className="song-title">{song.title}</h1>

          <div className="song-artist-row">
            <button type="button" className="artist-link" onClick={() => onSelectArtist(song.artistId)}>
              <span>{song.artistName}</span>
              <CheckCircle2 size={16} className="verified-icon" />
            </button>
            <span className="dot-sep">•</span>
            <span className="album-meta">
              {song.album} ({song.year})
            </span>
          </div>

          <div className="song-actions-row">
            <button
              type="button"
              className="primary-btn"
              style={{ backgroundColor: song.accentColor }}
              onClick={onTogglePlay}
            >
              {isBuffering ? (
                <Loader2 size={18} className="spin" />
              ) : isPlaying ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
              <span>
                {isBuffering ? 'Carregando áudio...' : isPlaying ? 'Pausar Música' : 'Ouvir Música Completa'}
              </span>
            </button>

            <button
              type="button"
              className={`secondary-btn ${ttsEnabled ? 'active-chip-btn' : ''}`}
              onClick={() => setTtsEnabled((v) => !v)}
              title="Ler a letra completa em voz alta sincronizada"
            >
              <Volume2 size={17} />
              <span>{ttsEnabled ? 'Voz: Ligada' : 'Ouvir Letra (Voz)'}</span>
            </button>

            <button type="button" className="secondary-btn" onClick={onOpenKaraoke}>
              <Mic2 size={17} />
              <span>Karaokê</span>
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                onOpenCardStudio(
                  selectedLineId ? [selectedLineId] : undefined,
                  liveLines.length > 0 ? liveLines : song.lines
                )
              }
            >
              <ImageIcon size={17} />
              <span>Criar Card</span>
            </button>

            <button type="button" className="secondary-btn" onClick={handleCopyLyrics}>
              {copied ? <Check size={17} /> : <Copy size={17} />}
              <span>{copied ? 'Copiada!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              className={`icon-action-btn ${isFavorite ? 'favorited' : ''}`}
              onClick={() => onToggleFavorite(song.id)}
              title={isFavorite ? 'Remover dos favoritos' : 'Favoritar música'}
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </header>

      {/* Mini Studio Scrubber + Waveform */}
      <div className="studio-player-bar">
        <button type="button" className="icon-btn" onClick={onToggleMute} title={isMuted ? 'Ativar som' : 'Silenciar'}>
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={isMuted ? 0 : volume}
          onChange={(e) => onChangeVolume(Number(e.target.value))}
          title="Volume"
          style={{ width: '68px', accentColor: song.accentColor, cursor: 'pointer' }}
        />
        <Visualizer isPlaying={isPlaying} accentColor={song.accentColor} bars={14} />
        <span className="mono-time">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={song.duration}
          step={0.5}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="studio-scrubber"
          style={{ accentColor: song.accentColor }}
        />
        <span className="mono-time">{formatTime(song.duration)}</span>
        <button
          type="button"
          className={`speed-pill ${followSynced ? 'active' : ''}`}
          onClick={() => setFollowSynced((v) => !v)}
          title="Rolar automaticamente acompanhando a música"
        >
          Seguir Letra
        </button>
        <div className="transpose-box" style={{ padding: '0.2rem 0.45rem' }}>
          <span className="cifra-label">Sinc:</span>
          <button type="button" className="mini-btn" onClick={() => setSyncOffset((s) => s - 1)} title="Atrasar letra 1s">
            -1s
          </button>
          <span className="mono-time" style={{ minWidth: '28px', textAlign: 'center' }}>
            {syncOffset > 0 ? `+${syncOffset}s` : `${syncOffset}s`}
          </span>
          <button type="button" className="mini-btn" onClick={() => setSyncOffset((s) => s + 1)} title="Adiantar letra 1s">
            +1s
          </button>
        </div>
        <span className="synth-badge">
          {song.chordProgression.map((c) => transposeChord(c, effectiveTranspose)).join(' → ')}
        </span>
      </div>

      {/* Mode Toolbar */}
      <div className="mode-toolbar">
        <div className="mode-tabs">
          <button
            type="button"
            className={`mode-tab ${mode === 'letra' ? 'active' : ''}`}
            onClick={() => setMode('letra')}
          >
            <BookOpen size={16} />
            <span>Letra</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'traducao' ? 'active' : ''}`}
            onClick={() => setMode('traducao')}
          >
            <Columns2 size={16} />
            <span>Lado a Lado</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'idiomas' ? 'active' : ''}`}
            onClick={() => setMode('idiomas')}
          >
            <Languages size={16} />
            <span>Modo Idiomas</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'cifra' ? 'active' : ''}`}
            onClick={() => {
              setMode('cifra');
              setStudioTab('acordes');
            }}
          >
            <Guitar size={16} />
            <span>Cifra Pro</span>
          </button>
        </div>

        <div className="cifra-controls">
          {(mode === 'traducao' || mode === 'idiomas') && (
            <div className="transpose-box">
              <span className="cifra-label">Idioma:</span>
              <select
                className="capo-select"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
              >
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'cifra' && (
            <>
              <div className="transpose-box">
                <span className="cifra-label">Tom:</span>
                <button type="button" className="mini-btn" onClick={() => onChangeTranspose(-1)} title="-1 semitom">
                  <ChevronDown size={15} />
                </button>
                <button type="button" className="transpose-val" onClick={onResetTranspose} title="Resetar tom">
                  {transposedKey} {transpose !== 0 && `(${transpose > 0 ? `+${transpose}` : transpose})`}
                </button>
                <button type="button" className="mini-btn" onClick={() => onChangeTranspose(1)} title="+1 semitom">
                  <ChevronUp size={15} />
                </button>
              </div>

              <div className="transpose-box">
                <span className="cifra-label">Capo:</span>
                <select
                  className="capo-select"
                  value={capo}
                  onChange={(e) => setCapo(Number(e.target.value))}
                >
                  <option value={0}>Sem capo</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                    <option key={c} value={c}>
                      {c}ª casa
                    </option>
                  ))}
                </select>
              </div>

              <div className="autoscroll-box">
                <span className="cifra-label">Rolagem:</span>
                {[0, 1, 2, 3].map((spd) => (
                  <button
                    type="button"
                    key={spd}
                    className={`speed-pill ${autoScrollSpeed === spd ? 'active' : ''}`}
                    onClick={() => setAutoScrollSpeed(spd)}
                  >
                    {spd === 0 ? 'Off' : `${spd}x`}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="autoscroll-box">
            <button
              type="button"
              className="mini-btn"
              onClick={() => setFontSize((f) => Math.max(0.92, +(f - 0.08).toFixed(2)))}
              title="Diminuir fonte"
            >
              A-
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={() => setFontSize((f) => Math.min(1.5, +(f + 0.08).toFixed(2)))}
              title="Aumentar fonte"
            >
              A+
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={() => setFocusMode((v) => !v)}
              title={focusMode ? 'Mostrar painel lateral' : 'Modo Foco'}
            >
              {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className={`song-workspace ${focusMode ? 'focus-mode' : ''}`}>
        <div className="lyrics-column" ref={lyricsContainerRef}>
          {loadingLyrics && (
            <div className="empty-state">Buscando letra sincronizada oficial para “{song.title}”...</div>
          )}

          {!loadingLyrics && liveLines.length === 0 && (
            <div className="empty-state">
              Letra não encontrada automaticamente na base pública para esta faixa. Você ainda pode ouvir a prévia e explorar os acordes!
            </div>
          )}

          {translating && (
            <div className="synth-badge" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
              {transProgress
                ? `Traduzindo letra completa: ${transProgress.done}/${transProgress.total} versos...`
                : 'Traduzindo 100% da letra...'}
            </div>
          )}

          {lyricsSource === 'synced' && (
            <div className="synth-badge" style={{ marginBottom: '0.75rem', display: 'inline-block', marginRight: '0.5rem' }}>
              Letra Sincronizada Oficial
            </div>
          )}

          {detectedLang && (
            <div className="synth-badge" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
              Idioma detectado: {detectedLang.toUpperCase()} → {targetLang}
            </div>
          )}

          {liveLines.map((line) => {
            if (line.isSection) {
              return (
                <div key={line.id} className="lyric-section-tag">
                  {line.text}
                </div>
              );
            }

            const isSynced = activeLineId === line.id;
            const isSelected = selectedLineId === line.id;
            const hasNote = Boolean(line.annotation || userAnnotations[`${song.id}:${line.id}`]);

            return (
              <div
                key={line.id}
                id={`lyric-line-${line.id}`}
                className={`lyric-row ${isSynced ? 'synced' : ''} ${isSelected ? 'selected' : ''} ${
                  hasNote ? 'annotated' : ''
                } mode-${mode}`}
                onClick={() => {
                  setSelectedLineId(line.id);
                  onSeek(line.time);
                  if (!isPlaying) onTogglePlay();
                }}
              >
                <span className="lyric-row-time">{formatTime(line.time)}</span>
                {mode === 'cifra' && renderChordLine(line)}

                {mode === 'traducao' ? (
                  <div className="side-by-side-grid">
                    <p className="lyric-text" style={{ fontSize: `${fontSize}rem` }}>
                      {line.text}
                    </p>
                    <p className="lyric-translation" style={{ fontSize: `${Math.max(0.9, fontSize - 0.08)}rem` }}>
                      {line.translation || '—'}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="lyric-text" style={{ fontSize: `${fontSize}rem` }}>
                      {line.text}
                      {hasNote && <span className="note-dot" title="Possui anotação" />}
                    </p>
                    {mode === 'idiomas' && line.translation && (
                      <p className="lyric-interlinear">{line.translation}</p>
                    )}
                    {mode === 'idiomas' && line.vocab && line.vocab.length > 0 && (
                      <div className="vocab-pills">
                        {line.vocab.map((v, i) => (
                          <div key={i} className="vocab-pill">
                            <strong>{v.word}</strong>
                            {v.phonetic && <span className="vocab-ipa">{v.phonetic}</span>}
                            <span>→ {v.meaning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="lyric-row-card-btn"
                  title="Criar card deste verso"
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = liveLines.findIndex((l) => l.id === line.id);
                    const next = liveLines[idx + 1];
                    const ids = next && !next.isSection ? [line.id, next.id] : [line.id];
                    onOpenCardStudio(ids, liveLines);
                  }}
                >
                  <ImageIcon size={13} />
                </button>
              </div>
            );
          })}

          <div className="song-credits-footer">
            <div className="panel-eyebrow">CRÉDITOS AO AUTOR & DIREITOS</div>
            <div>
              <strong>Autor / Intérprete:</strong> {song.artistName} • <strong>Composição:</strong>{' '}
              {song.credits.writers.join(', ')}
            </div>
            <div>
              <strong>Álbum:</strong> {song.album} ({song.year}) • <strong>Gravadora / Selo:</strong>{' '}
              {song.credits.label}
            </div>
            <div className="credits-sources">
              Fontes: Letra sincronizada via <strong>LRCLIB</strong> • Biografia via{' '}
              <strong>Wikipédia (CC BY-SA)</strong> • Catálogo & Capas via <strong>Apple Music / iTunes</strong>
            </div>
          </div>
        </div>

        {!focusMode && (
          <aside className="studio-sidebar">
            <div className="studio-tabs studio-tabs-4">
              <button
                type="button"
                className={`studio-tab ${studioTab === 'artista' ? 'active' : ''}`}
                onClick={() => setStudioTab('artista')}
              >
                <User size={15} />
                <span>Artista</span>
              </button>
              <button
                type="button"
                className={`studio-tab ${studioTab === 'anotacoes' ? 'active' : ''}`}
                onClick={() => setStudioTab('anotacoes')}
              >
                <Sparkles size={15} />
                <span>Notas</span>
              </button>
              <button
                type="button"
                className={`studio-tab ${studioTab === 'acordes' ? 'active' : ''}`}
                onClick={() => setStudioTab('acordes')}
              >
                <Guitar size={15} />
                <span>Acordes</span>
              </button>
              <button
                type="button"
                className={`studio-tab ${studioTab === 'analise' ? 'active' : ''}`}
                onClick={() => setStudioTab('analise')}
              >
                <Sliders size={15} />
                <span>Raio-X</span>
              </button>
            </div>

            {studioTab === 'artista' && (
              <div className="studio-panel-content">
                <div className="artist-spotlight-mini">
                  <CoverArt
                    src={artistBio?.thumbnail || song.coverImage}
                    gradient={song.coverGradient}
                    alt={song.artistName}
                    className="artist-mini-photo"
                  />
                  <div>
                    <div className="panel-eyebrow">TUDO SOBRE O ARTISTA</div>
                    <h3 className="artist-mini-name">{song.artistName}</h3>
                    <span className="artist-mini-meta">
                      {song.flag} {song.country} • {song.genre}
                    </span>
                  </div>
                </div>

                {loadingArtist ? (
                  <p className="empty-note-hint">Carregando biografia e discografia completa...</p>
                ) : (
                  <>
                    <p className="artist-bio-text">{artistBio?.summary}</p>
                    {artistBio?.wikipediaUrl && (
                      <a
                        href={artistBio.wikipediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-btn full-width"
                      >
                        <ExternalLink size={15} />
                        <span>Ler biografia completa na Wikipédia</span>
                      </a>
                    )}

                    {artistBio && artistBio.albums.length > 0 && (
                      <div>
                        <div className="panel-eyebrow" style={{ marginTop: '0.5rem' }}>
                          DISCOGRAFIA & ÁLBUNS
                        </div>
                        <div className="mini-albums-grid">
                          {artistBio.albums.map((alb) => (
                            <div key={alb.id} className="mini-album-card">
                              <img src={alb.cover} alt={alb.title} className="mini-album-cover" />
                              <div className="mini-album-title">{alb.title}</div>
                              <div className="mini-album-year">{alb.year}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className="primary-btn full-width"
                      onClick={() => onSelectArtist(song.artistId)}
                    >
                      <Disc3 size={16} />
                      <span>Abrir Página Completa de {song.artistName}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {studioTab === 'anotacoes' && (
              <div className="studio-panel-content">
                <div className="story-box">
                  <div className="panel-eyebrow">SOBRE A MÚSICA</div>
                  <p>{song.story}</p>
                </div>

                {selectedLine && (
                  <div className="selected-line-box">
                    <div className="panel-eyebrow">VERSO SELECIONADO</div>
                    <blockquote className="selected-quote">“{selectedLine.text}”</blockquote>

                    {selectedLineAnnotation ? (
                      <div className="annotation-card">
                        <div className="annotation-meta">
                          <span className="annotation-cat">{selectedLineAnnotation.category}</span>
                          <span className="annotation-author">{selectedLineAnnotation.author}</span>
                        </div>
                        <h4>{selectedLineAnnotation.title}</h4>
                        <p>{selectedLineAnnotation.body}</p>
                      </div>
                    ) : (
                      <p className="empty-note-hint">
                        Este verso ainda não tem anotação editorial. Adicione sua interpretação!
                      </p>
                    )}

                    {!showNoteForm ? (
                      <button
                        type="button"
                        className="secondary-btn full-width"
                        onClick={() => setShowNoteForm(true)}
                      >
                        <MessageSquarePlus size={16} />
                        <span>{selectedLineAnnotation ? 'Editar / Substituir Anotação' : 'Adicionar Anotação'}</span>
                      </button>
                    ) : (
                      <form className="note-form" onSubmit={handleSaveUserNote}>
                        <input
                          type="text"
                          placeholder="Título da interpretação (ex: Metáfora oculta)"
                          value={newNoteTitle}
                          onChange={(e) => setNewNoteTitle(e.target.value)}
                        />
                        <textarea
                          rows={3}
                          placeholder="Explique o significado, referência ou contexto deste verso..."
                          value={newNoteBody}
                          onChange={(e) => setNewNoteBody(e.target.value)}
                          required
                        />
                        <div className="note-form-actions">
                          <button type="button" className="ghost-btn" onClick={() => setShowNoteForm(false)}>
                            Cancelar
                          </button>
                          <button type="submit" className="primary-btn">
                            Salvar Nota
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {studioTab === 'acordes' && (
              <div className="studio-panel-content">
                <div className="panel-eyebrow">ACORDES DA MÚSICA (CLIQUE PARA OUVIR)</div>
                <div className="chord-chip-grid">
                  {uniqueChords.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`chord-chip ${selectedChord === c ? 'active' : ''}`}
                      onClick={() => setSelectedChord(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <ChordDiagram chord={selectedChord} />
                <p className="chord-tip">
                  Dica: use <strong>Capo</strong> ou <strong>Tom</strong> na barra acima no modo <strong>Cifra Pro</strong> para adaptar ao seu alcance vocal.
                </p>
              </div>
            )}

            {studioTab === 'analise' && (
              <div className="studio-panel-content">
                <div className="panel-eyebrow">RAIO-X POÉTICO & MUSICAL</div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-val">{poeticStats.verses}</span>
                    <span className="stat-lbl">Versos</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-val">{poeticStats.uniqueWords}</span>
                    <span className="stat-lbl">Palavras Únicas</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-val">{poeticStats.lexicalRichness}%</span>
                    <span className="stat-lbl">Riqueza Lexical</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-val">{poeticStats.avgWordsPerLine}</span>
                    <span className="stat-lbl">Palavras / Verso</span>
                  </div>
                </div>

                <div className="progression-box">
                  <div className="panel-eyebrow">PROGRESSÃO HARMÔNICA PRINCIPAL</div>
                  <div className="prog-pills">
                    {song.chordProgression.map((c, i) => (
                      <span key={i} className="prog-pill">
                        {transposeChord(c, effectiveTranspose)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="tags-box">
                  <div className="panel-eyebrow">ATMÓSFERA & TAGS</div>
                  <div className="tag-list">
                    {song.tags.map((t) => (
                      <span key={t} className="tag-pill">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
