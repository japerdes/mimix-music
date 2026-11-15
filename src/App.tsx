import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, Heart, Loader2, Mic2, Pause, Play, Repeat1, Search, Shuffle, SkipBack, SkipForward, Sparkles, Users, Volume2, VolumeX } from 'lucide-react';
import { ARTISTS, PLAYLISTS, SONGS } from './data/catalog';
import { Artist, Genre, LineAnnotation, LyricLine, Song } from './types/music';
import { HomeView } from './components/HomeView';
import { SongView } from './components/SongView';
import { MimixMark } from './components/MimixLogo';
import { ArtistView } from './components/ArtistView';
import { ArtistsDirectoryView } from './components/ArtistsDirectoryView';
import { CommandPalette } from './components/CommandPalette';
import { KaraokeOverlay } from './components/KaraokeOverlay';
import { LyricCardModal } from './components/LyricCardModal';
import { CoverArt } from './components/CoverArt';
import { FeedPost, FeedView } from './components/FeedView';

type RouteState =
  | { view: 'home' }
  | { view: 'feed' }
  | { view: 'artists' }
  | { view: 'song'; songId: string }
  | { view: 'artist'; artistId: string };

export function App() {
  const [route, setRoute] = useState<RouteState>({ view: 'home' });
  const [searchOpen, setSearchOpen] = useState(false);
  const [karaokeOpen, setKaraokeOpen] = useState(false);
  const [cardModalData, setCardModalData] = useState<{ lineIds: string[]; lines?: LyricLine[] } | null>(null);
  const [importedSongs, setImportedSongs] = useState<Song[]>([]);
  const [importedArtists, setImportedArtists] = useState<Artist[]>([]);
  const [songDurations, setSongDurations] = useState<Record<string, number>>({});
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(() => {
    try {
      const saved = localStorage.getItem('verso_feed_posts_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    const s1 = SONGS.find((s) => s.title.toLowerCase().includes('perfect')) || SONGS[0];
    const s2 = SONGS.find((s) => s.title.toLowerCase().includes('time')) || SONGS[1];
    return [
      {
        id: 'seed-1',
        author: 'Ana Beatriz',
        caption: 'Esse trecho é perfeito demais 💙',
        createdAt: 'Há 12 min',
        songId: s1.id,
        songTitle: s1.title,
        artistName: s1.artistName,
        coverImage: s1.coverImage,
        lines: [
          {
            text: 'Now I know I have met an angel in person',
            translation: 'Agora eu sei que encontrei um anjo pessoalmente',
          },
          {
            text: 'And she looks perfect',
            translation: 'E ela está perfeita',
          },
        ],
        outerBg: '#146d83',
        cardBg: '#1d8da8',
        textColor: '#0C0C0E',
        snippetStart: 58,
        snippetEnd: 74,
        likes: 42,
      },
      {
        id: 'seed-2',
        author: 'Lucas Silva',
        caption: 'Clássico que nunca perde a força.',
        createdAt: 'Há 45 min',
        songId: s2.id,
        songTitle: s2.title,
        artistName: s2.artistName,
        coverImage: s2.coverImage,
        lines: [
          {
            text: 'I have loved you for a thousand years',
            translation: 'Eu te amei por mil anos',
          },
          {
            text: "I'll love you for a thousand more",
            translation: 'Eu te amarei por mais mil',
          },
        ],
        outerBg: '#b24940',
        cardBg: '#d16258',
        textColor: '#0C0C0E',
        snippetStart: 72,
        snippetEnd: 90,
        likes: 87,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('verso_feed_posts_v1', JSON.stringify(feedPosts));
    } catch {}
  }, [feedPosts]);

  // Native VERSO Audio Player State
  const [activeSongId, setActiveSongId] = useState<string>(SONGS[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [shuffle, setShuffle] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const allSongs = useMemo(
    () =>
      [...SONGS, ...importedSongs].map((s) =>
        songDurations[s.id] ? { ...s, duration: songDurations[s.id] } : s
      ),
    [importedSongs, songDurations]
  );

  const handleDurationLoaded = useCallback((songId: string, duration: number) => {
    if (duration > 10) {
      setSongDurations((prev) => (prev[songId] === duration ? prev : { ...prev, [songId]: duration }));
    }
  }, []);

  // Persisted Favorites & User Annotations
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('verso_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [userAnnotations, setUserAnnotations] = useState<Record<string, LineAnnotation>>(() => {
    try {
      const saved = localStorage.getItem('verso_annotations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('verso_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('verso_annotations', JSON.stringify(userAnnotations));
  }, [userAnnotations]);

  // Deep link support (?song=id&t=seconds) for shared card snippets
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedSongId = params.get('song');
    const sharedTime = Number(params.get('t') || '0');
    if (sharedSongId) {
      const found = SONGS.find((s) => s.id === sharedSongId);
      if (found) {
        setRoute({ view: 'song', songId: found.id });
        setActiveSongId(found.id);
        if (sharedTime > 0) {
          setCurrentTime(sharedTime);
          window.setTimeout(() => {
            if (audioRef.current) audioRef.current.currentTime = sharedTime;
          }, 400);
        }
      }
    }
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K, '/', Space, Left/Right, M, K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (isTyping || searchOpen || cardModalData !== null) return;

      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (audioRef.current) {
          const nextT = Math.min(audioRef.current.duration || 999, audioRef.current.currentTime + 5);
          audioRef.current.currentTime = nextT;
          setCurrentTime(nextT);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (audioRef.current) {
          const prevT = Math.max(0, audioRef.current.currentTime - 5);
          audioRef.current.currentTime = prevT;
          setCurrentTime(prevT);
        }
      } else if (e.key.toLowerCase() === 'm') {
        setIsMuted((m) => !m);
      } else if (e.key.toLowerCase() === 'k') {
        setKaraokeOpen((k) => !k);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, cardModalData]);

  const activeSong = useMemo(
    () => allSongs.find((s) => s.id === activeSongId) || allSongs[0],
    [activeSongId, allSongs]
  );

  const streamUrl = useMemo(() => {
    const cleanTitle = activeSong.title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = activeSong.artistName.split('&')[0].split(',')[0].trim();
    return `/api/stream?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle} Topic`)}`;
  }, [activeSong.id, activeSong.title, activeSong.artistName]);

  // Sync audio element properties
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    audio.volume = volume;
    audio.playbackRate = speed;
  }, [isMuted, volume, speed]);

  // Sync Play/Pause with native <audio>
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      setIsBuffering(true);
      void audio
        .play()
        .then(() => setIsBuffering(false))
        .catch(() => setIsBuffering(false));
    } else {
      audio.pause();
      setIsBuffering(false);
    }
  }, [isPlaying, streamUrl]);

  // High-precision 80ms polling for ultra-smooth synced lyrics
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && isFinite(audio.duration) && audio.duration > 10) {
          handleDurationLoaded(activeSong.id, Math.round(audio.duration));
        }
      }
    }, 80);
    return () => clearInterval(id);
  }, [isPlaying, activeSong.id, handleDurationLoaded]);

  const handleSeek = useCallback((t: number) => {
    setCurrentTime(t);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = t;
    }
  }, []);

  const handleSelectSong = useCallback(
    (songId: string) => {
      if (songId !== activeSongId) {
        setActiveSongId(songId);
        setCurrentTime(0);
        setTranspose(0);
        setIsPlaying(false);
      }
      setRoute({ view: 'song', songId });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activeSongId]
  );

  const handleImportWebSong = useCallback((song: Song) => {
    setImportedSongs((prev) => (prev.some((s) => s.id === song.id) ? prev : [song, ...prev]));
    setImportedArtists((prev) => {
      if (ARTISTS.some((a) => a.id === song.artistId) || prev.some((a) => a.id === song.artistId)) {
        return prev;
      }
      const newArtist: Artist = {
        id: song.artistId,
        name: song.artistName,
        genre: song.genre,
        country: song.country || 'Global',
        flag: song.flag || '🌍',
        monthlyListeners: '2.4M',
        verified: true,
        bio: `${song.artistName} — artista no catálogo global do MIMIX.`,
        coverImage: song.coverImage,
        coverGradient: song.coverGradient,
        accentColor: song.accentColor,
        topTags: [song.genre, song.country || 'Global'],
      };
      return [newArtist, ...prev];
    });
    setActiveSongId(song.id);
    setCurrentTime(0);
    setTranspose(0);
    setIsPlaying(true);
    setRoute({ view: 'song', songId: song.id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleQuickPlay = useCallback(
    (songId: string) => {
      if (songId !== activeSongId) {
        setActiveSongId(songId);
        setCurrentTime(0);
        setTranspose(0);
        setIsPlaying(true);
      } else {
        setIsPlaying((p) => !p);
      }
    },
    [activeSongId]
  );

  const handleToggleFavorite = (songId: string) => {
    setFavorites((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  const handleSaveAnnotation = (lineKey: string, annotation: LineAnnotation) => {
    setUserAnnotations((prev) => ({ ...prev, [lineKey]: annotation }));
  };

  const allArtists = useMemo(() => [...ARTISTS, ...importedArtists], [importedArtists]);

  const handleImportWebArtist = useCallback((artist: Artist, artistSongs: Song[]) => {
    setImportedArtists((prev) =>
      prev.some((a) => a.id === artist.id) ? prev : [artist, ...prev]
    );
    if (artistSongs.length > 0) {
      setImportedSongs((prev) => {
        const existing = new Set(prev.map((s) => s.id));
        const fresh = artistSongs.filter((s) => !existing.has(s.id));
        return fresh.length > 0 ? [...fresh, ...prev] : prev;
      });
    }
  }, []);

  const currentSongInView =
    route.view === 'song' ? allSongs.find((s) => s.id === route.songId) || allSongs[0] : null;
  const currentArtistInView =
    route.view === 'artist' ? allArtists.find((a) => a.id === route.artistId) || allArtists[0] : null;

  const handleStepTrack = useCallback(
    (delta: number) => {
      const idx = allSongs.findIndex((s) => s.id === activeSongId);
      const nextIdx =
        shuffle && allSongs.length > 1
          ? Math.floor(Math.random() * allSongs.length)
          : (idx + delta + allSongs.length) % allSongs.length;
      const nextSong = allSongs[nextIdx];
      if (!nextSong) return;
      setActiveSongId(nextSong.id);
      setCurrentTime(0);
      setIsPlaying(true);
      if (route.view === 'song') {
        setRoute({ view: 'song', songId: nextSong.id });
      }
    },
    [allSongs, activeSongId, route.view, shuffle]
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="app-shell">
      {/* Native Site Audio Element */}
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="metadata"
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={(e) => {
          const el = e.currentTarget;
          if (activeSong.previewUrl && el.src !== activeSong.previewUrl) {
            el.src = activeSong.previewUrl;
            if (isPlaying) {
              el.play().catch(() => setIsBuffering(false));
            }
          } else {
            setIsBuffering(false);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && isFinite(d) && d > 10) {
            handleDurationLoaded(activeSong.id, Math.round(d));
          }
        }}
        onEnded={() => {
          if (repeatOne && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } else {
            handleStepTrack(1);
          }
        }}
      />

      {/* Sticky Top Navbar */}
      <nav className="top-nav">
        <div className="nav-inner">
          <button
            type="button"
            className="brand-logo"
            onClick={() => {
              setRoute({ view: 'home' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span className="brand-mark-wrap">
              <MimixMark size={34} />
            </span>
            <span className="brand-text">MIMIX</span>
            <span className="brand-tag">STUDIO</span>
          </button>

          <button type="button" className="nav-search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
            <span>Buscar música, artista, país, idioma ou na internet...</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="nav-actions">
            <button
              type="button"
              className={`nav-link ${route.view === 'home' ? 'active' : ''}`}
              onClick={() => setRoute({ view: 'home' })}
            >
              Explorar
            </button>
            <button
              type="button"
              className={`nav-link ${route.view === 'feed' ? 'active' : ''}`}
              onClick={() => {
                setRoute({ view: 'feed' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span>Feed ({feedPosts.length})</span>
            </button>
            <button
              type="button"
              className={`nav-link ${route.view === 'artists' ? 'active' : ''}`}
              onClick={() => {
                setRoute({ view: 'artists' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <Users size={15} />
              <span>Artistas</span>
            </button>
            <button
              type="button"
              className={`nav-link ${route.view === 'song' ? 'active' : ''}`}
              onClick={() => handleSelectSong(activeSong.id)}
            >
              <Sparkles size={15} />
              <span>Estúdio</span>
            </button>
            <div className="nav-fav-count" title="Músicas favoritas">
              <Heart size={15} />
              <span>{favorites.length}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-container">
        {route.view === 'home' && (
          <HomeView
            songs={allSongs}
            artists={ARTISTS}
            playlists={PLAYLISTS}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onSelectSong={handleSelectSong}
            onSelectArtist={(artistId) => {
              setRoute({ view: 'artist', artistId });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenAllArtists={() => {
              setRoute({ view: 'artists' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onQuickPlay={handleQuickPlay}
            onImportWebSong={handleImportWebSong}
          />
        )}

        {route.view === 'feed' && (
          <FeedView
            posts={feedPosts}
            songs={allSongs}
            onToggleLike={(postId) =>
              setFeedPosts((prev) =>
                prev.map((p) =>
                  p.id === postId
                    ? {
                        ...p,
                        likedByMe: !p.likedByMe,
                        likes: p.likedByMe ? Math.max(0, p.likes - 1) : p.likes + 1,
                      }
                    : p
                )
              )
            }
            onSelectSong={handleSelectSong}
            onCreatePost={() => {
              handleSelectSong(activeSong.id);
              setCardModalData({ lineIds: [] });
            }}
          />
        )}

        {route.view === 'artists' && (
          <ArtistsDirectoryView
            artists={allArtists}
            songs={allSongs}
            onSelectArtist={(artistId) => {
              setRoute({ view: 'artist', artistId });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onImportWebArtist={handleImportWebArtist}
          />
        )}

        {route.view === 'song' && currentSongInView && (
          <SongView
            song={currentSongInView}
            isFavorite={favorites.includes(currentSongInView.id)}
            onToggleFavorite={handleToggleFavorite}
            onSelectArtist={(artistId) => {
              setRoute({ view: 'artist', artistId });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBack={() => setRoute({ view: 'home' })}
            isPlaying={isPlaying}
            isBuffering={isBuffering}
            currentTime={currentTime}
            transpose={transpose}
            isMuted={isMuted}
            volume={volume}
            onChangeVolume={(v) => setVolume(v)}
            onTogglePlay={() => {
              if (activeSongId !== currentSongInView.id) {
                setActiveSongId(currentSongInView.id);
                setCurrentTime(0);
                setIsPlaying(true);
              } else {
                setIsPlaying((p) => !p);
              }
            }}
            onSeek={handleSeek}
            onChangeTranspose={(delta) =>
              setTranspose((t) => Math.max(-6, Math.min(6, t + delta)))
            }
            onResetTranspose={() => setTranspose(0)}
            onToggleMute={() => setIsMuted((m) => !m)}
            onOpenKaraoke={() => setKaraokeOpen(true)}
            onOpenCardStudio={(lines, resolvedLines) =>
              setCardModalData({ lineIds: lines || [], lines: resolvedLines })
            }
            userAnnotations={userAnnotations}
            onSaveAnnotation={handleSaveAnnotation}
            onDurationLoaded={handleDurationLoaded}
          />
        )}

        {route.view === 'artist' && currentArtistInView && (
          <ArtistView
            artist={currentArtistInView}
            songs={allSongs.filter((s) => s.artistId === currentArtistInView.id)}
            onBack={() => setRoute({ view: 'artists' })}
            onSelectSong={handleSelectSong}
          />
        )}
      </main>

      {/* Persistent Native Pro Mini-Player Dock */}
      {(isPlaying || currentTime > 0 || isBuffering) && !karaokeOpen && (
        <div className="mini-player-dock">
          <div className="mini-player-inner">
            <div className="mini-player-track" onClick={() => handleSelectSong(activeSong.id)}>
              <CoverArt
                src={activeSong.coverImage}
                gradient={activeSong.coverGradient}
                alt={activeSong.title}
                className="mini-cover"
              >
                <Disc3 size={16} className={isPlaying ? 'spin-slow' : ''} />
              </CoverArt>
              <div>
                <div className="mini-title">{activeSong.title}</div>
                <div className="mini-artist">
                  {activeSong.artistName} • {formatTime(currentTime)} / {formatTime(activeSong.duration)}
                </div>
              </div>
            </div>

            <div className="mini-player-controls">
              <button
                type="button"
                className={`icon-btn ${shuffle ? 'accent-icon' : ''}`}
                onClick={() => setShuffle((s) => !s)}
                title={shuffle ? 'Aleatório ativado' : 'Ativar aleatório'}
              >
                <Shuffle size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => handleStepTrack(-1)}
                title="Música anterior"
              >
                <SkipBack size={16} />
              </button>
              <button
                type="button"
                className="mini-play-btn"
                style={{ backgroundColor: activeSong.accentColor }}
                onClick={() => setIsPlaying((p) => !p)}
              >
                {isBuffering ? <Loader2 size={16} className="spin-slow" /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => handleStepTrack(1)}
                title="Próxima música"
              >
                <SkipForward size={16} />
              </button>
              <button
                type="button"
                className={`icon-btn ${repeatOne ? 'accent-icon' : ''}`}
                onClick={() => setRepeatOne((r) => !r)}
                title={repeatOne ? 'Repetir faixa ativado' : 'Repetir faixa'}
              >
                <Repeat1 size={15} />
              </button>

              <input
                type="range"
                min={0}
                max={activeSong.duration || 210}
                step={0.5}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="mini-dock-scrubber"
                style={{ accentColor: activeSong.accentColor }}
                title="Avançar / retroceder"
              />

              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsMuted((m) => !m)}
                title={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{ width: '64px', accentColor: activeSong.accentColor, cursor: 'pointer' }}
                title="Volume"
              />
              <button
                type="button"
                className="mini-karaoke-btn"
                onClick={() => setKaraokeOpen(true)}
              >
                <Mic2 size={15} />
                <span>Karaokê</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals & Overlays */}
      <CommandPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        songs={allSongs}
        artists={ARTISTS}
        onSelectSong={handleSelectSong}
        onSelectArtist={(artistId) => setRoute({ view: 'artist', artistId })}
        onImportWebSong={handleImportWebSong}
      />

      {karaokeOpen && (
        <KaraokeOverlay
          song={activeSong}
          currentTime={currentTime}
          isPlaying={isPlaying}
          speed={speed}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onSeek={handleSeek}
          onChangeSpeed={(s) => setSpeed(s)}
          onClose={() => setKaraokeOpen(false)}
        />
      )}

      {cardModalData !== null && currentSongInView && (
        <LyricCardModal
          song={currentSongInView}
          lines={cardModalData.lines}
          initialLines={cardModalData.lineIds}
          onClose={() => setCardModalData(null)}
          onPostToFeed={(newPost) => {
            setFeedPosts((prev) => [newPost, ...prev]);
            setCardModalData(null);
            setRoute({ view: 'feed' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}

export default App;
