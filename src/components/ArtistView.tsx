import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Disc3, ExternalLink, Play, TrendingUp } from 'lucide-react';
import { Artist, Song } from '../types/music';
import { CoverArt } from './CoverArt';
import { ArtistBioData, fetchArtistDetails } from '../utils/artistApi';

interface ArtistViewProps {
  artist: Artist;
  songs: Song[];
  onBack: () => void;
  onSelectSong: (songId: string) => void;
}

export const ArtistView: React.FC<ArtistViewProps> = ({ artist, songs, onBack, onSelectSong }) => {
  const [bioData, setBioData] = useState<ArtistBioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArtistDetails(artist.name).then((data) => {
      if (cancelled) return;
      setBioData(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [artist.name]);

  return (
    <div className="artist-view">
      <div className="artist-banner" style={{ background: artist.coverGradient }}>
        {(bioData?.thumbnail || artist.coverImage) && (
          <img
            src={bioData?.thumbnail || artist.coverImage}
            alt={artist.name}
            className="hero-bg-photo"
          />
        )}
        <div className="hero-overlay" />
        <button type="button" className="back-pill" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Voltar</span>
        </button>

        <div className="artist-banner-content">
          <div className="artist-verified-badge">
            <CheckCircle2 size={16} />
            <span>
              Artista Verificado • {artist.flag} {artist.country}
            </span>
          </div>
          <h1 className="artist-name-xl">{artist.name}</h1>
          <p className="artist-bio">
            {loading ? 'Carregando biografia completa...' : bioData?.summary || artist.bio}
          </p>
          <div className="artist-meta-row">
            <span>{artist.monthlyListeners} ouvintes mensais</span>
            <span>•</span>
            <span>{artist.genre}</span>
            {bioData?.wikipediaUrl && (
              <a
                href={bioData.wikipediaUrl}
                target="_blank"
                rel="noreferrer"
                className="mini-tag link-tag"
              >
                Fonte: Wikipédia <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      </div>

      <section className="artist-tracks-section" style={{ marginBottom: '2.5rem' }}>
        <div className="section-header">
          <h2>
            <Disc3 size={20} className="accent-icon" />
            <span>Músicas & Letras de {artist.name}</span>
          </h2>
        </div>

        <div className="chart-list">
          {songs.map((song, idx) => (
            <button
              type="button"
              key={song.id}
              className="chart-row"
              onClick={() => onSelectSong(song.id)}
            >
              <span className="chart-rank">{idx + 1}</span>
              <CoverArt
                src={song.coverImage}
                gradient={song.coverGradient}
                alt={song.title}
                className="chart-cover"
              >
                <Play size={16} />
              </CoverArt>
              <div className="chart-info">
                <div className="chart-title">{song.title}</div>
                <div className="chart-sub">
                  {song.album} ({song.year}) • Tom {song.musicalKey} • {song.bpm} BPM
                </div>
              </div>
              <div className="chart-badges">
                {song.language !== 'pt' && <span className="mini-tag">Tradução</span>}
                <span className="mini-tag">Cifra</span>
              </div>
              <div className="chart-views">
                <TrendingUp size={14} />
                <span>{song.views}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {bioData && bioData.albums.length > 0 && (
        <section className="artist-tracks-section">
          <div className="section-header">
            <h2>
              <Disc3 size={20} className="accent-icon" />
              <span>Discografia & Álbuns Oficiais</span>
            </h2>
          </div>

          <div className="artists-grid">
            {bioData.albums.map((alb) => (
              <div key={alb.id} className="artist-card" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
                <img
                  src={alb.cover}
                  alt={alb.title}
                  style={{ width: '100%', aspectRatio: '1/1', borderRadius: '10px', objectFit: 'cover' }}
                />
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alb.title}</div>
                <div className="artist-card-meta">
                  {alb.year} {alb.trackCount ? `• ${alb.trackCount} faixas` : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
