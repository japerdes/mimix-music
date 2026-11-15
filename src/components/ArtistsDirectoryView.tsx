import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Globe2, Loader2, Mic2, Search } from 'lucide-react';
import { Artist, Genre, Song } from '../types/music';
import { CoverArt } from './CoverArt';

interface WebArtistHit {
  artistId: number;
  artistName: string;
  primaryGenreName?: string;
}

interface ArtistsDirectoryViewProps {
  artists: Artist[];
  songs: Song[];
  onSelectArtist: (artistId: string) => void;
  onImportWebArtist?: (artist: Artist, artistSongs: Song[]) => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const ArtistsDirectoryView: React.FC<ArtistsDirectoryViewProps> = ({
  artists,
  songs,
  onSelectArtist,
  onImportWebArtist,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('Todos');
  const [selectedGenre, setSelectedGenre] = useState('Todos');
  const [selectedLetter, setSelectedLetter] = useState('Todos');
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [webArtists, setWebArtists] = useState<WebArtistHit[]>([]);
  const [loadingWeb, setLoadingWeb] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setWebArtists([]);
      setLoadingWeb(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingWeb(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=14`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setWebArtists(Array.isArray(data.results) ? data.results : []);
        }
      } catch {
        // ignore abort
      } finally {
        setLoadingWeb(false);
      }
    }, 320);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleOpenWebArtist = async (hit: WebArtistHit) => {
    if (!onImportWebArtist) return;
    setImportingId(hit.artistId);
    const slug =
      hit.artistName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `artist-${hit.artistId}`;

    let importedSongs: Song[] = [];
    let coverImg = '';
    try {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${hit.artistId}&entity=song&limit=15`
      );
      if (res.ok) {
        const data = await res.json();
        const tracks = (data.results || []).filter(
          (r: { wrapperType?: string }) => r.wrapperType === 'track'
        );
        if (tracks.length > 0) {
          coverImg = (tracks[0].artworkUrl100 || '').replace('100x100bb', '600x600bb');
          importedSongs = tracks.map(
            (
              t: {
                trackId: number;
                trackName: string;
                collectionName?: string;
                primaryGenreName?: string;
                artworkUrl100?: string;
                previewUrl?: string;
                releaseDate?: string;
                trackTimeMillis?: number;
                country?: string;
              },
              idx: number
            ) => ({
              id: `web-${t.trackId}`,
              title: t.trackName,
              artistId: slug,
              artistName: hit.artistName,
              album: t.collectionName || 'Single',
              year: parseInt((t.releaseDate || '').slice(0, 4), 10) || 2024,
              genre: (t.primaryGenreName as Genre) || 'Pop',
              country: t.country || 'Global',
              flag: '🌍',
              language: 'en',
              languageLabel: 'Global',
              bpm: 110,
              musicalKey: 'C',
              duration: Math.max(90, Math.round((t.trackTimeMillis || 210000) / 1000)),
              views: 'Web',
              viewsNum: 500000 - idx * 10000,
              trendDelta: 12,
              rank: idx + 1,
              coverImage: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
              coverGradient: 'linear-gradient(135deg, #6366F1 0%, #111115 100%)',
              accentColor: '#818CF8',
              tags: [t.primaryGenreName || 'Pop', 'Global'],
              chordProgression: ['Am', 'F', 'C', 'G'],
              story: `Faixa de ${hit.artistName} no álbum ${t.collectionName || 'Single'}.`,
              previewUrl: t.previewUrl || '',
              credits: {
                writers: [hit.artistName],
                producers: [hit.artistName],
                label: t.collectionName || 'Catálogo Global',
              },
              lines: [],
            })
          );
        }
      }
    } catch {
      // ignore
    }

    const newArtist: Artist = {
      id: slug,
      name: hit.artistName,
      verified: true,
      country: 'Global',
      flag: '🌍',
      genre: (hit.primaryGenreName as Genre) || 'Pop',
      monthlyListeners: 'Global',
      bio: `${hit.artistName} — artista importado ao vivo do catálogo mundial.`,
      coverGradient: 'linear-gradient(135deg, #6366F1, #18181B)',
      coverImage: coverImg,
      accentColor: '#818CF8',
      topTags: [hit.primaryGenreName || 'Pop', 'Global'],
    };

    onImportWebArtist(newArtist, importedSongs);
    setImportingId(null);
    onSelectArtist(slug);
  };

  const countries = useMemo(() => {
    const map = new Map<string, string>();
    artists.forEach((a) => {
      if (a.country) map.set(a.country, a.flag || '🌍');
    });
    return Array.from(map.entries());
  }, [artists]);

  const genres = useMemo(() => {
    return ['Todos', ...Array.from(new Set(artists.map((a) => a.genre || 'Pop')))];
  }, [artists]);

  const songCountByArtist = useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach((s) => {
      map.set(s.artistId, (map.get(s.artistId) || 0) + 1);
    });
    return map;
  }, [songs]);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    artists.forEach((a) => {
      const ch = (a.name || '').trim().charAt(0).toUpperCase();
      if (ch) set.add(ch);
    });
    return set;
  }, [artists]);

  useEffect(() => {
    setVisibleLimit(60);
  }, [query, selectedCountry, selectedGenre, selectedLetter]);

  const filteredArtists = useMemo(() => {
    const q = query.trim().toLowerCase();
    return artists
      .filter((a) => {
        if (selectedCountry !== 'Todos' && a.country !== selectedCountry) return false;
        if (selectedGenre !== 'Todos' && a.genre !== selectedGenre) return false;
        if (selectedLetter !== 'Todos' && !a.name.toUpperCase().startsWith(selectedLetter)) return false;
        if (
          q &&
          !a.name.toLowerCase().includes(q) &&
          !a.country.toLowerCase().includes(q) &&
          !a.genre.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [artists, query, selectedCountry, selectedGenre, selectedLetter]);

  return (
    <div className="directory-view">
      <header className="directory-header">
        <div>
          <div className="hero-pill">
            <Globe2 size={14} />
            <span>DIRETÓRIO GLOBAL • {artists.length} ARTISTAS • {countries.length} PAÍSES</span>
          </div>
          <h1 className="directory-title">Todos os Artistas</h1>
          <p className="section-sub">
            Explore cantores, bandas e produtores de todo o mundo filtrando por país, estilo ou ordem alfabética.
          </p>
        </div>

        <div className="directory-search-box">
          <Search size={17} className="cp-search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar artista, país ou gênero..."
          />
        </div>
      </header>

      {/* Alphabet A-Z Bar */}
      <div className="alphabet-bar">
        <button
          type="button"
          className={`alpha-btn ${selectedLetter === 'Todos' ? 'active' : ''}`}
          onClick={() => setSelectedLetter('Todos')}
        >
          Todos
        </button>
        {ALPHABET.map((letter) => {
          const hasAny = availableLetters.has(letter);
          return (
            <button
              type="button"
              key={letter}
              disabled={!hasAny}
              className={`alpha-btn ${selectedLetter === letter ? 'active' : ''} ${!hasAny ? 'disabled' : ''}`}
              onClick={() => setSelectedLetter(letter)}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Country Filter Pills */}
      <div className="filter-section-block">
        <div className="panel-eyebrow">FILTRAR POR PAÍS</div>
        <div className="genre-pills">
          <button
            type="button"
            className={`genre-pill ${selectedCountry === 'Todos' ? 'active' : ''}`}
            onClick={() => setSelectedCountry('Todos')}
          >
            🌍 Todos os Países
          </button>
          {countries.map(([country, flag]) => (
            <button
              type="button"
              key={country}
              className={`genre-pill ${selectedCountry === country ? 'active' : ''}`}
              onClick={() => setSelectedCountry(selectedCountry === country ? 'Todos' : country)}
            >
              {flag} {country}
            </button>
          ))}
        </div>
      </div>

      {/* Genre Filter Pills */}
      <div className="filter-section-block">
        <div className="panel-eyebrow">FILTRAR POR ESTILO</div>
        <div className="genre-pills">
          {genres.map((g) => (
            <button
              type="button"
              key={g}
              className={`genre-pill ${selectedGenre === g ? 'active' : ''}`}
              onClick={() => setSelectedGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Artists Grid */}
      <div className="directory-grid">
        {filteredArtists.slice(0, visibleLimit).map((artist) => {
          const count = songCountByArtist.get(artist.id) || 0;
          return (
            <button
              type="button"
              key={artist.id}
              className="directory-artist-card"
              onClick={() => onSelectArtist(artist.id)}
            >
              <CoverArt
                src={artist.coverImage}
                gradient={artist.coverGradient}
                alt={artist.name}
                className="directory-artist-avatar"
              />
              <div className="directory-artist-info">
                <div className="artist-card-name">
                  <span>{artist.name}</span>
                  {artist.verified && <CheckCircle2 size={15} className="verified-icon" />}
                </div>
                <div className="directory-artist-meta">
                  <span>{artist.flag} {artist.country}</span>
                  <span>•</span>
                  <span>{artist.genre}</span>
                </div>
                <div className="directory-artist-stats">
                  <span><Mic2 size={12} /> {artist.monthlyListeners} ouvintes</span>
                  <span>•</span>
                  <span>{count} {count === 1 ? 'letra' : 'letras'}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filteredArtists.length > visibleLimit && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setVisibleLimit((v) => v + 60)}
          >
            Carregar mais artistas ({filteredArtists.length - visibleLimit} restantes)
          </button>
        </div>
      )}

      {filteredArtists.length === 0 && webArtists.length === 0 && !loadingWeb && (
        <div className="empty-state">
          Nenhum artista encontrado com esses filtros. Tente selecionar “Todos” ou digitar outro nome.
        </div>
      )}

      {/* Live Unlimited Global Artists */}
      {(loadingWeb || webArtists.length > 0) && query.trim().length >= 3 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', fontSize: '1rem' }}>
            {loadingWeb ? <Loader2 size={16} className="spin" /> : <Globe2 size={16} className="accent-icon" />}
            <span>Artistas no Catálogo Mundial (Busca ao Vivo)</span>
          </h3>
          <div className="directory-grid">
            {webArtists.map((hit) => (
              <button
                type="button"
                key={hit.artistId}
                className="directory-artist-card"
                onClick={() => handleOpenWebArtist(hit)}
                disabled={importingId === hit.artistId}
              >
                <div className="directory-artist-avatar" style={{ background: 'linear-gradient(135deg, #6366F1, #18181B)', display: 'grid', placeItems: 'center' }}>
                  {importingId === hit.artistId ? <Loader2 size={20} className="spin" /> : <Mic2 size={20} />}
                </div>
                <div className="directory-artist-info">
                  <div className="artist-card-name">
                    <span>{hit.artistName}</span>
                    <CheckCircle2 size={15} className="verified-icon" />
                  </div>
                  <div className="directory-artist-meta">
                    <span>🌍 Global</span>
                    <span>•</span>
                    <span>{hit.primaryGenreName || 'Música'}</span>
                  </div>
                  <div className="directory-artist-stats">
                    <span>{importingId === hit.artistId ? 'Importando discografia...' : 'Abrir perfil e músicas →'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
