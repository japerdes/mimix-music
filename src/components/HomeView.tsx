import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Disc3,
  Flame,
  Globe2,
  Heart,
  Languages,
  ListMusic,
  Loader2,
  Mic2,
  Play,
  Quote,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Artist, Genre, Playlist, Song } from '../types/music';
import { CoverArt } from './CoverArt';

interface WebTrackItem {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  primaryGenreName?: string;
  country?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
}

interface HomeViewProps {
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  favorites: string[];
  onToggleFavorite: (songId: string) => void;
  onSelectSong: (songId: string) => void;
  onSelectArtist: (artistId: string) => void;
  onOpenAllArtists: () => void;
  onQuickPlay: (songId: string) => void;
  onImportWebSong?: (song: Song) => void;
}

const GENRES: ('Todos' | Genre)[] = [
  'Todos',
  'MPB',
  'Pop',
  'Sertanejo',
  'Rap & Trap',
  'Funk',
  'Pagode',
  'Rock',
  'Indie',
  'Bossa Nova',
  'Gospel',
  'Eletrônica',
  'K-Pop',
  'J-Pop',
  'Afrobeats',
  'Reggaeton',
  'Chanson',
];

const GENRE_CARDS: { genre: Genre; color: string; desc: string }[] = [
  { genre: 'MPB', color: '#FF6B3D', desc: 'Poesia urbana & violão' },
  { genre: 'Pop', color: '#818CF8', desc: 'Synth-pop & hits globais' },
  { genre: 'Sertanejo', color: '#FBBF24', desc: 'Modão, viola & karaokê' },
  { genre: 'Rap & Trap', color: '#34D399', desc: 'Rimas, flow & referências' },
  { genre: 'Funk', color: '#FB7185', desc: 'Baile, grave & 130 BPM' },
  { genre: 'Pagode', color: '#2DD4BF', desc: 'Cavaco & roda de samba' },
  { genre: 'K-Pop', color: '#F472B6', desc: 'Seul • Coreano & Inglês' },
  { genre: 'J-Pop', color: '#FB7185', desc: 'Tóquio • City Pop' },
  { genre: 'Afrobeats', color: '#34D399', desc: 'Lagos • Groove & metais' },
  { genre: 'Reggaeton', color: '#FBBF24', desc: 'Medellín • Urbano latino' },
  { genre: 'Chanson', color: '#60A5FA', desc: 'Paris • Francês poético' },
  { genre: 'Rock', color: '#F87171', desc: 'Guitarras & cifras fáceis' },
];

type GroupMode = 'charts' | 'country' | 'language';

export const HomeView: React.FC<HomeViewProps> = ({
  songs,
  artists,
  playlists,
  favorites,
  onToggleFavorite,
  onSelectSong,
  onSelectArtist,
  onOpenAllArtists,
  onQuickPlay,
  onImportWebSong,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');
  const [selectedCountry, setSelectedCountry] = useState<string>('Todos');
  const [onlyTranslated, setOnlyTranslated] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>('charts');
  const [visibleCount, setVisibleCount] = useState(30);
  const [zoneQuery, setZoneQuery] = useState('');
  const [webTracks, setWebTracks] = useState<WebTrackItem[]>([]);
  const [loadingWeb, setLoadingWeb] = useState(false);

  useEffect(() => {
    const q = zoneQuery.trim();
    if (q.length < 3) {
      setWebTracks([]);
      setLoadingWeb(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingWeb(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setWebTracks(Array.isArray(data.results) ? data.results : []);
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
  }, [zoneQuery]);

  const importAndOpen = (t: WebTrackItem, autoPlay = false) => {
    if (!onImportWebSong) return;
    const cover = (t.artworkUrl100 || '').replace('100x100bb', '600x600bb');
    const year = parseInt((t.releaseDate || '').slice(0, 4), 10) || 2024;
    const duration = Math.max(90, Math.round((t.trackTimeMillis || 210000) / 1000));
    const newSong: Song = {
      id: `web-${t.trackId}`,
      title: t.trackName,
      artistId: t.artistName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      artistName: t.artistName,
      album: t.collectionName || 'Single',
      year,
      genre: (t.primaryGenreName as Genre) || 'Pop',
      country: t.country || 'Global',
      flag: '🌍',
      language: 'en',
      languageLabel: 'Global',
      bpm: 112,
      musicalKey: 'C',
      duration,
      views: 'Web',
      viewsNum: 500000,
      trendDelta: 15,
      rank: 1,
      coverImage: cover,
      coverGradient: 'linear-gradient(135deg, #6366F1 0%, #111115 100%)',
      accentColor: '#818CF8',
      tags: [t.primaryGenreName || 'Pop', 'Global'],
      chordProgression: ['Am', 'F', 'C', 'G'],
      story: `Importada ao vivo do catálogo global (${t.collectionName || 'Single'}, ${year}).`,
      previewUrl: t.previewUrl || '',
      credits: {
        writers: [t.artistName],
        producers: [t.artistName],
        label: t.collectionName || 'Catálogo Global',
      },
      lines: [],
    };
    onImportWebSong(newSong);
    if (autoPlay) onQuickPlay(newSong.id);
    else onSelectSong(newSong.id);
  };

  const featuredSong = songs[0];
  const wallSongs = useMemo(() => songs.slice(0, 10), [songs]);

  const dynamicGenres = useMemo(() => {
    const counts = new Map<string, number>();
    songs.forEach((s) => counts.set(s.genre, (counts.get(s.genre) || 0) + 1));
    return ['Todos', ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([g]) => g)];
  }, [songs]);

  const countries = useMemo(() => {
    const map = new Map<string, string>();
    songs.forEach((s) => map.set(s.country, s.flag));
    return Array.from(map.entries());
  }, [songs]);

  const topTrending = useMemo(
    () => [...songs].sort((a, b) => b.trendDelta - a.trendDelta).slice(0, 3),
    [songs]
  );

  const filteredSongs = useMemo(() => {
    const q = zoneQuery.trim().toLowerCase();
    return songs.filter((s) => {
      if (q) {
        const hit =
          s.title.toLowerCase().includes(q) ||
          s.artistName.toLowerCase().includes(q) ||
          s.album.toLowerCase().includes(q) ||
          s.genre.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (selectedGenre !== 'Todos') {
        const sg = s.genre.toLowerCase();
        const sel = selectedGenre.toLowerCase();
        if (sel === 'rap & trap' && !(sg.includes('hip-hop') || sg.includes('rap'))) return false;
        else if (sel === 'eletrônica' && !(sg.includes('electronic') || sg.includes('dance'))) return false;
        else if (sel === 'chanson' && !(sg.includes('french') || sg.includes('chanson'))) return false;
        else if (sel !== 'rap & trap' && sel !== 'eletrônica' && sel !== 'chanson' && !sg.includes(sel)) {
          return false;
        }
      }
      if (selectedCountry !== 'Todos' && s.country !== selectedCountry) return false;
      if (onlyTranslated && s.language === 'pt') return false;
      if (onlyFavorites && !favorites.includes(s.id)) return false;
      return true;
    });
  }, [songs, zoneQuery, selectedGenre, selectedCountry, onlyTranslated, onlyFavorites, favorites]);

  const groupedSections = useMemo(() => {
    if (groupMode === 'charts') return null;
    const map = new Map<string, { label: string; items: Song[] }>();
    filteredSongs.forEach((s) => {
      const key = groupMode === 'country' ? `${s.flag} ${s.country}` : s.languageLabel;
      const existing = map.get(key);
      if (existing) existing.items.push(s);
      else map.set(key, { label: key, items: [s] });
    });
    return Array.from(map.values());
  }, [filteredSongs, groupMode]);

  const renderSongRow = (song: Song, indexOverride?: number) => {
    const isFav = favorites.includes(song.id);
    return (
      <div key={song.id} className="chart-row" onClick={() => onSelectSong(song.id)}>
        <span className="chart-rank">{indexOverride ?? song.rank}</span>
        <CoverArt
          src={song.coverImage}
          gradient={song.coverGradient}
          alt={song.title}
          className="chart-cover"
          onClick={(e) => {
            e.stopPropagation();
            onQuickPlay(song.id);
          }}
          title="Tocar base musical"
        >
          <Play size={16} />
        </CoverArt>

        <div className="chart-info">
          <div className="chart-title">{song.title}</div>
          <div className="chart-sub">
            <span
              className="chart-artist-link"
              onClick={(e) => {
                e.stopPropagation();
                onSelectArtist(song.artistId);
              }}
            >
              {song.artistName}
            </span>
            <span> • {song.album}</span>
          </div>
        </div>

        <div className="chart-badges">
          <span className="mini-tag">{song.genre}</span>
          <span className="mini-tag">{song.flag} {song.country}</span>
        </div>

        <div className="chart-views">{song.views}</div>

        <button
          type="button"
          className={`fav-row-btn ${isFav ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(song.id);
          }}
          title={isFav ? 'Remover dos favoritos' : 'Favoritar'}
        >
          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  };

  return (
    <div className="home-view">
      {/* Bento Hero */}
      <section className="bento-hero">
        <div className="hero-spotlight" style={{ background: featuredSong.coverGradient }}>
          {featuredSong.coverImage && (
            <img src={featuredSong.coverImage} alt={featuredSong.title} className="hero-bg-photo" />
          )}
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="hero-pill">
              <Flame size={14} />
              <span>DESTAQUE GLOBAL • {songs.length} MÚSICAS • {countries.length} PAÍSES</span>
            </div>
            <h1 className="hero-title">{featuredSong.title}</h1>
            <p className="hero-subtitle">
              por <strong>{featuredSong.artistName}</strong> • {featuredSong.album} ({featuredSong.year})
            </p>
            <blockquote className="hero-quote">
              “{featuredSong.lines.find((l) => !l.isSection)?.text || featuredSong.story}”
            </blockquote>

            <div className="hero-actions">
              <button type="button" className="primary-btn" onClick={() => onQuickPlay(featuredSong.id)}>
                <Play size={17} fill="currentColor" />
                <span>Ouvir Agora</span>
              </button>
              <button type="button" className="secondary-btn" onClick={() => onSelectSong(featuredSong.id)}>
                <Sparkles size={17} />
                <span>Letra & Tradução</span>
              </button>
            </div>
          </div>

          <div className="hero-cover-stage" aria-hidden="true">
            <CoverArt
              src={featuredSong.coverImage}
              gradient={featuredSong.coverGradient}
              alt={featuredSong.title}
              className="hero-featured-cover"
            />
          </div>
        </div>

        {/* Right Bento Column */}
        <div className="bento-side">
          <div className="bento-card">
            <div className="bento-card-header">
              <span className="panel-eyebrow">EM ALTA NO MUNDO</span>
              <TrendingUp size={15} className="accent-icon" />
            </div>
            <div className="mini-trending-list">
              {topTrending.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="mini-trending-row"
                  onClick={() => onSelectSong(s.id)}
                >
                  <CoverArt
                    src={s.coverImage}
                    gradient={s.coverGradient}
                    alt={s.title}
                    className="mini-trend-cover"
                  >
                    <Play size={12} />
                  </CoverArt>
                  <div className="mini-trend-info">
                    <strong>
                      {s.flag} {s.title}
                    </strong>
                    <span>
                      {s.artistName} • {s.genre}
                    </span>
                  </div>
                  <span className="trend-badge">▲ {s.trendDelta}%</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="bento-card editorial-story-card"
            onClick={() =>
              onSelectSong(songs.find((s) => s.country === 'Coreia do Sul')?.id || songs[1]?.id || songs[0].id)
            }
          >
            <div className="bento-card-header">
              <span className="panel-eyebrow">IDIOMAS & CULTURA</span>
              <ArrowUpRight size={16} className="accent-icon" />
            </div>
            <div className="story-quote-row">
              <Quote size={18} className="accent-icon" />
              <p>Aprenda Coreano, Japonês, Francês, Italiano, Alemão, Espanhol e Inglês cantando</p>
            </div>
            <span className="story-card-foot">Explorar Modo Idiomas com fonética IPA →</span>
          </button>
        </div>
      </section>

      {/* Zona Musical — Album Wall */}
      <section className="catalog-section">
        <div className="section-header-wrap">
          <div className="section-title-group">
            <h2>
              <Disc3 size={20} className="accent-icon" />
              <span>Zona Musical • Capas em Alta</span>
            </h2>
            <p className="section-sub">
              Clique na capa para abrir o estúdio com letra sincronizada ou aperte play direto
            </p>
          </div>
          <div className="live-eq-pill">
            <span className="eq-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>{songs.length.toLocaleString('pt-BR')} faixas no catálogo</span>
          </div>
        </div>

        <div className="album-wall-grid">
          {wallSongs.map((s) => (
            <div
              key={s.id}
              className="album-wall-card"
              onClick={() => onSelectSong(s.id)}
              style={{ ['--card-accent' as string]: s.accentColor }}
            >
              <div className="album-wall-cover-wrap">
                <CoverArt
                  src={s.coverImage}
                  gradient={s.coverGradient}
                  alt={s.title}
                  className="album-wall-cover"
                />
                <button
                  type="button"
                  className="album-wall-play"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickPlay(s.id);
                  }}
                  title={`Ouvir ${s.title}`}
                >
                  <Play size={18} fill="currentColor" />
                </button>
                <span className="album-wall-flag">{s.flag}</span>
              </div>
              <div className="album-wall-info">
                <strong>{s.title}</strong>
                <span>{s.artistName}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Genre Tiles */}
      <section className="catalog-section">
        <div className="section-title-group" style={{ marginBottom: '1rem' }}>
          <h2>Explorar por Estilo</h2>
          <p className="section-sub">Todos os ritmos do Brasil e do mundo em um só lugar</p>
        </div>
        <div className="genre-tiles-grid">
          {GENRE_CARDS.map((item) => {
            const active = selectedGenre === item.genre;
            return (
              <button
                type="button"
                key={item.genre}
                className={`genre-tile ${active ? 'active' : ''}`}
                style={{ '--tile-accent': item.color } as React.CSSProperties}
                onClick={() => setSelectedGenre(active ? 'Todos' : item.genre)}
              >
                <span className="genre-tile-dot" style={{ backgroundColor: item.color }} />
                <strong>{item.genre}</strong>
                <span>{item.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Charts / Grouped by Country or Language */}
      <section className="catalog-section">
        <div className="section-header-wrap">
          <div className="section-title-group">
            <h2>
              <Globe2 size={20} className="accent-icon" />
              <span>Catálogo Global & Paradas</span>
            </h2>
            <p className="section-sub">
              {filteredSongs.length} {filteredSongs.length === 1 ? 'música encontrada' : 'músicas encontradas'}
            </p>
          </div>

          <div className="filter-toggles">
            <div className="group-switcher">
              <button
                type="button"
                className={`group-btn ${groupMode === 'charts' ? 'active' : ''}`}
                onClick={() => setGroupMode('charts')}
              >
                Paradas
              </button>
              <button
                type="button"
                className={`group-btn ${groupMode === 'country' ? 'active' : ''}`}
                onClick={() => setGroupMode('country')}
              >
                Por País
              </button>
              <button
                type="button"
                className={`group-btn ${groupMode === 'language' ? 'active' : ''}`}
                onClick={() => setGroupMode('language')}
              >
                Por Idioma
              </button>
            </div>

            <button
              type="button"
              className={`filter-chip ${onlyTranslated ? 'active' : ''}`}
              onClick={() => setOnlyTranslated((v) => !v)}
            >
              <Languages size={14} />
              <span>Com Tradução</span>
            </button>
            <button
              type="button"
              className={`filter-chip ${onlyFavorites ? 'active' : ''}`}
              onClick={() => setOnlyFavorites((v) => !v)}
            >
              <Heart size={14} />
              <span>Favoritas ({favorites.length})</span>
            </button>
          </div>
        </div>

        {/* Inline Zone Search */}
        <div className="zone-search-bar">
          <Search size={16} />
          <input
            type="text"
            value={zoneQuery}
            onChange={(e) => {
              setZoneQuery(e.target.value);
              setVisibleCount(30);
            }}
            placeholder={`Filtrar entre ${songs.length.toLocaleString('pt-BR')} músicas por título, artista, álbum ou gênero...`}
          />
          {zoneQuery && (
            <button type="button" className="mini-btn" onClick={() => setZoneQuery('')}>
              Limpar
            </button>
          )}
        </div>

        {/* Country Filter Pills */}
        <div className="genre-pills" style={{ marginBottom: '0.65rem' }}>
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

        {/* Genre Filter Pills */}
        <div className="genre-pills">
          {dynamicGenres.slice(0, 14).map((g) => (
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

        {groupMode === 'charts' && (
          <>
            <div className="chart-list">
              {filteredSongs.slice(0, visibleCount).map((s, i) => renderSongRow(s, i + 1))}
            </div>
            {filteredSongs.length > visibleCount && (
              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setVisibleCount((c) => c + 50)}
                >
                  Carregar mais músicas ({filteredSongs.length - visibleCount} restantes)
                </button>
              </div>
            )}
          </>
        )}

        {groupedSections && (
          <div className="grouped-catalog">
            {groupedSections.map((sec) => (
              <div key={sec.label} className="grouped-block">
                <h3 className="grouped-title">
                  <span>{sec.label}</span>
                  <span className="grouped-count">{sec.items.length}</span>
                </h3>
                <div className="chart-list">
                  {sec.items.slice(0, 15).map((s, idx) => renderSongRow(s, idx + 1))}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredSongs.length === 0 && webTracks.length === 0 && !loadingWeb && (
          <div className="empty-state">
            Nenhuma música encontrada com esses filtros. Tente limpar os filtros ou digitar outro artista/título.
          </div>
        )}

        {/* Live Unlimited Global Catalog Results */}
        {(loadingWeb || webTracks.length > 0) && zoneQuery.trim().length >= 3 && (
          <div style={{ marginTop: '1.75rem' }}>
            <div className="section-header-wrap" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                {loadingWeb ? <Loader2 size={16} className="spin" /> : <Globe2 size={16} className="accent-icon" />}
                <span>Catálogo Global da Internet (Milhões de Faixas)</span>
              </h3>
            </div>
            <div className="chart-list">
              {webTracks.map((t, idx) => (
                <div
                  key={t.trackId}
                  className="chart-row"
                  onClick={() => importAndOpen(t, false)}
                >
                  <span className="chart-rank">{idx + 1}</span>
                  <CoverArt
                    src={(t.artworkUrl100 || '').replace('100x100bb', '600x600bb')}
                    gradient="linear-gradient(135deg, #6366F1 0%, #111115 100%)"
                    alt={t.trackName}
                    className="chart-cover"
                    onClick={(e) => {
                      e.stopPropagation();
                      importAndOpen(t, true);
                    }}
                  >
                    <Play size={16} />
                  </CoverArt>
                  <div className="chart-info">
                    <div className="chart-title">{t.trackName}</div>
                    <div className="chart-sub">
                      <span>{t.artistName}</span>
                      <span> • {t.collectionName || 'Single'}</span>
                    </div>
                  </div>
                  <div className="chart-badges">
                    <span className="mini-tag">{t.primaryGenreName || 'Pop'}</span>
                    <span className="mini-tag">🌍 Web</span>
                  </div>
                  <div className="chart-views">Abrir</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Playlists */}
      <section className="catalog-section">
        <div className="section-title-group">
          <h2>
            <ListMusic size={20} className="accent-icon" />
            <span>Playlists & Trilhas de Estudo</span>
          </h2>
        </div>

        <div className="playlists-grid">
          {playlists.map((pl) => (
            <button
              type="button"
              key={pl.id}
              className="playlist-card"
              onClick={() => onSelectSong(pl.songIds[0])}
            >
              <CoverArt
                src={pl.coverImage}
                gradient={pl.coverGradient}
                alt={pl.title}
                className="playlist-cover"
              >
                <span className="playlist-count">{pl.songIds.length} faixas</span>
              </CoverArt>
              <div className="playlist-body">
                <h3>{pl.title}</h3>
                <p>{pl.subtitle}</p>
                <span className="playlist-curator">Por {pl.curator}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Artists Preview */}
      <section className="catalog-section">
        <div className="section-header-wrap">
          <div className="section-title-group">
            <h2>
              <Mic2 size={20} className="accent-icon" />
              <span>Artistas em Destaque</span>
            </h2>
          </div>
          <button type="button" className="secondary-btn" onClick={onOpenAllArtists}>
            <span>Ver todos os {artists.length} artistas →</span>
          </button>
        </div>

        <div className="artists-grid">
          {artists.slice(0, 8).map((artist) => (
            <button
              type="button"
              key={artist.id}
              className="artist-card"
              onClick={() => onSelectArtist(artist.id)}
            >
              <CoverArt
                src={artist.coverImage}
                gradient={artist.coverGradient}
                alt={artist.name}
                className="artist-avatar"
              />
              <div className="artist-card-name">
                <span>{artist.name}</span>
                {artist.verified && <CheckCircle2 size={14} className="verified-icon" />}
              </div>
              <div className="artist-card-meta">
                {artist.flag} {artist.genre} • {artist.monthlyListeners}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
