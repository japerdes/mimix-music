import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, Globe2, Loader2, Mic2, Music2, Search, X } from 'lucide-react';
import { Artist, Song } from '../types/music';
import { CoverArt } from './CoverArt';

interface WebTrackResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  primaryGenreName?: string;
  country?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  releaseDate?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  artists: Artist[];
  onSelectSong: (songId: string) => void;
  onSelectArtist: (artistId: string) => void;
  onImportWebSong: (song: Song) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  songs,
  artists,
  onSelectSong,
  onSelectArtist,
  onImportWebSong,
}) => {
  const [query, setQuery] = useState('');
  const [webResults, setWebResults] = useState<WebTrackResult[]>([]);
  const [loadingWeb, setLoadingWeb] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setWebResults([]);
    }
  }, [isOpen]);

  // Live internet search via iTunes public catalog API
  useEffect(() => {
    const q = query.trim();
    if (!isOpen || q.length < 3) {
      setWebResults([]);
      setLoadingWeb(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingWeb(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=6`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setWebResults(Array.isArray(data.results) ? data.results : []);
        }
      } catch {
        // Ignore abort or offline errors gracefully
      } finally {
        setLoadingWeb(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        songs: songs.slice(0, 4).map((s) => ({ song: s, matchedLine: null as string | null })),
        artists: artists.slice(0, 3),
      };
    }

    const matchedSongs = songs
      .map((song) => {
        const titleMatch =
          song.title.toLowerCase().includes(q) ||
          song.artistName.toLowerCase().includes(q) ||
          song.genre.toLowerCase().includes(q) ||
          song.country.toLowerCase().includes(q) ||
          song.languageLabel.toLowerCase().includes(q) ||
          (song.tags || []).some((t) => t.toLowerCase().includes(q));
        const lineMatch = (song.lines || []).find(
          (l) =>
            !l.isSection &&
            (l.text.toLowerCase().includes(q) || (l.translation && l.translation.toLowerCase().includes(q)))
        );
        if (titleMatch || lineMatch) {
          return { song, matchedLine: lineMatch ? lineMatch.text : null };
        }
        return null;
      })
      .filter((x): x is { song: Song; matchedLine: string | null } => x !== null)
      .slice(0, 20);

    const matchedArtists = artists
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.genre.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q)
      )
      .slice(0, 10);

    return { songs: matchedSongs, artists: matchedArtists };
  }, [query, songs, artists]);

  const handlePickWebTrack = (item: WebTrackResult) => {
    const hiResCover = item.artworkUrl100
      ? item.artworkUrl100.replace('100x100bb', '600x600bb')
      : '';
    const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : 2026;
    const artistSlug =
      item.artistName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'artista-web';
    const newSong: Song = {
      id: `web-${item.trackId}`,
      title: item.trackName,
      artistId: artistSlug,
      artistName: item.artistName,
      album: item.collectionName || 'Single',
      year,
      genre: 'Pop',
      country: item.country || 'Global',
      flag: '🌍',
      language: 'en',
      languageLabel: 'Global',
      bpm: 110,
      musicalKey: 'Am',
      duration: 30,
      views: 'Web',
      viewsNum: 100000,
      trendDelta: 15,
      rank: 99,
      coverImage: hiResCover,
      coverGradient: 'linear-gradient(135deg, #FF6B3D 0%, #6366F1 55%, #09090B 100%)',
      accentColor: '#FF6B3D',
      tags: [item.primaryGenreName || 'Global', 'Web Import'],
      chordProgression: ['Am', 'F', 'C', 'G'],
      story: `Faixa importada ao vivo do catálogo global (${item.collectionName || 'Single'}, ${year}).`,
      previewUrl: item.previewUrl,
      credits: {
        writers: [item.artistName],
        producers: [item.artistName],
        label: item.primaryGenreName || 'Global Music',
      },
      lines: [
        { id: 'w1', time: 0, text: '[Intro — Prévia Oficial]', isSection: true },
        {
          id: 'w2',
          time: 2,
          text: `${item.trackName} — ${item.artistName}`,
          translation: `Álbum: ${item.collectionName || 'Single'} (${year})`,
          chords: [
            { pos: 0, chord: 'Am' },
            { pos: 18, chord: 'F' },
          ],
        },
        {
          id: 'w3',
          time: 10,
          text: 'Adicione suas anotações, cifra ou crie um Lyric Card personalizado.',
          chords: [
            { pos: 0, chord: 'C' },
            { pos: 22, chord: 'G' },
          ],
        },
      ],
    };
    onImportWebSong(newSong);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cp-input-row">
          <Search size={18} className="cp-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busque qualquer música, artista, país, idioma ou trecho..."
            className="cp-input"
          />
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="cp-results">
          {results.songs.length > 0 && (
            <div className="cp-section">
              <div className="cp-section-label">Catálogo MIMIX</div>
              {results.songs.map(({ song, matchedLine }) => (
                <button
                  type="button"
                  key={song.id}
                  className="cp-item"
                  onClick={() => {
                    onSelectSong(song.id);
                    onClose();
                  }}
                >
                  <CoverArt
                    src={song.coverImage}
                    gradient={song.coverGradient}
                    alt={song.title}
                    className="cp-thumb"
                  >
                    <Music2 size={14} />
                  </CoverArt>
                  <div className="cp-item-info">
                    <div className="cp-item-title">
                      {song.flag} {song.title} <span className="cp-muted">— {song.artistName}</span>
                    </div>
                    {matchedLine ? (
                      <div className="cp-snippet">“{matchedLine}”</div>
                    ) : (
                      <div className="cp-sub">
                        {song.genre} • {song.languageLabel} • Tom {song.musicalKey}
                      </div>
                    )}
                  </div>
                  <span className="cp-badge">{song.views}</span>
                </button>
              ))}
            </div>
          )}

          {results.artists.length > 0 && (
            <div className="cp-section">
              <div className="cp-section-label">Artistas</div>
              {results.artists.map((artist) => (
                <button
                  type="button"
                  key={artist.id}
                  className="cp-item"
                  onClick={() => {
                    onSelectArtist(artist.id);
                    onClose();
                  }}
                >
                  <CoverArt
                    src={artist.coverImage}
                    gradient={artist.coverGradient}
                    alt={artist.name}
                    className="cp-thumb round"
                  />
                  <div className="cp-item-info">
                    <div className="cp-item-title">
                      {artist.flag} {artist.name}
                    </div>
                    <div className="cp-sub">
                      {artist.genre} • {artist.country} • {artist.monthlyListeners}
                    </div>
                  </div>
                  <Disc3 size={15} className="cp-muted" />
                </button>
              ))}
            </div>
          )}

          {query.trim().length >= 3 && (
            <div className="cp-section">
              <div className="cp-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Globe2 size={12} />
                <span>Resultados da Internet (Catálogo Global)</span>
                {loadingWeb && <Loader2 size={12} className="spin-slow" />}
              </div>

              {webResults.map((item) => (
                <button
                  type="button"
                  key={item.trackId}
                  className="cp-item"
                  onClick={() => handlePickWebTrack(item)}
                >
                  <CoverArt
                    src={item.artworkUrl100}
                    gradient="linear-gradient(135deg, #FF6B3D, #6366F1)"
                    alt={item.trackName}
                    className="cp-thumb"
                  />
                  <div className="cp-item-info">
                    <div className="cp-item-title">
                      {item.trackName} <span className="cp-muted">— {item.artistName}</span>
                    </div>
                    <div className="cp-sub">
                      {item.primaryGenreName || 'Global'} • {item.collectionName || 'Single'}
                    </div>
                  </div>
                  <span className="mini-tag">Abrir no Estúdio</span>
                </button>
              ))}
            </div>
          )}

          {results.songs.length === 0 && results.artists.length === 0 && webResults.length === 0 && !loadingWeb && (
            <div className="cp-empty">
              Nenhum resultado para “{query}”. Digite 3+ letras para buscar na internet também.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
