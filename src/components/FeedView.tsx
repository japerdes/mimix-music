import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Pause, Play, Plus, Share2, Sparkles } from 'lucide-react';
import { Song } from '../types/music';
import { MimixMark } from './MimixLogo';

export interface FeedPost {
  id: string;
  author: string;
  caption?: string;
  createdAt: string;
  songId: string;
  songTitle: string;
  artistName: string;
  coverImage: string;
  lines: { text: string; translation?: string }[];
  outerBg: string;
  cardBg: string;
  textColor: string;
  snippetStart: number;
  snippetEnd: number;
  likes: number;
  likedByMe?: boolean;
}

interface FeedViewProps {
  posts: FeedPost[];
  songs: Song[];
  onToggleLike: (postId: string) => void;
  onSelectSong: (songId: string) => void;
  onCreatePost: () => void;
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export const FeedView: React.FC<FeedViewProps> = ({
  posts,
  songs,
  onToggleLike,
  onSelectSong,
  onCreatePost,
}) => {
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activePost = posts.find((p) => p.id === playingPostId) || null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activePost) {
      audio?.pause();
      return;
    }
    const url = `/api/stream?q=${encodeURIComponent(`${activePost.artistName} ${activePost.songTitle} Topic`)}`;
    if (!audio.src.endsWith(url)) {
      audio.src = url;
    }
    audio.currentTime = activePost.snippetStart || 0;
    audio.play().catch(() => {
      const fallbackPreview = songs.find((s) => s.id === activePost.songId)?.previewUrl;
      if (fallbackPreview && audio.src !== fallbackPreview) {
        audio.src = fallbackPreview;
        audio.currentTime = 0;
        audio.play().catch(() => setPlayingPostId(null));
      } else {
        setPlayingPostId(null);
      }
    });

    const timer = window.setInterval(() => {
      if (audio.currentTime >= (activePost.snippetEnd || activePost.snippetStart + 18)) {
        audio.currentTime = activePost.snippetStart || 0;
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [playingPostId, activePost]);

  const handleSharePost = (post: FeedPost) => {
    const url = `${window.location.origin}/?song=${encodeURIComponent(post.songId)}&t=${Math.floor(
      post.snippetStart
    )}&end=${Math.ceil(post.snippetEnd)}`;
    const text = `${post.lines.map((l) => l.text).join('\n')}\n— ${post.songTitle}, ${post.artistName}\n${url}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="feed-view">
      <audio ref={audioRef} preload="none" />

      <header className="feed-header">
        <div>
          <div className="hero-pill">
            <Sparkles size={14} />
            <span>FEED DA COMUNIDADE • TRECHOS & CARDS</span>
          </div>
          <h1 className="directory-title">Feed Musical</h1>
          <p className="section-sub">
            Poste seus trechos favoritos no estilo card, ouça os recortes da comunidade e descubra novas letras.
          </p>
        </div>

        <button type="button" className="primary-btn" onClick={onCreatePost}>
          <Plus size={18} />
          <span>Criar Card & Postar</span>
        </button>
      </header>

      <div className="feed-masonry-grid">
        {posts.map((post) => {
          const isPlayingThis = playingPostId === post.id;
          return (
            <article key={post.id} className="feed-post-shell">
              {/* Author bar */}
              <div className="feed-post-author">
                <div className="feed-avatar">{post.author.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{post.author}</strong>
                  <span>{post.createdAt}</span>
                </div>
                <button
                  type="button"
                  className={`feed-listen-pill ${isPlayingThis ? 'playing' : ''}`}
                  onClick={() => setPlayingPostId(isPlayingThis ? null : post.id)}
                >
                  {isPlayingThis ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                  <span>
                    {isPlayingThis
                      ? 'Tocando trecho'
                      : `Ouvir ${formatSec(post.snippetStart)}–${formatSec(post.snippetEnd)}`}
                  </span>
                </button>
              </div>

              {post.caption && <p className="feed-post-caption">{post.caption}</p>}

              {/* Spotify-style Card Visual */}
              <div
                className="spotify-feed-card-frame"
                style={{ backgroundColor: post.outerBg }}
                onClick={() => onSelectSong(post.songId)}
              >
                <div
                  className="spotify-feed-card-inner"
                  style={{ backgroundColor: post.cardBg, color: post.textColor }}
                >
                  <div className="sfc-header">
                    {post.coverImage ? (
                      <img src={post.coverImage} alt={post.songTitle} className="sfc-cover" />
                    ) : (
                      <div className="sfc-cover sfc-cover-fallback" />
                    )}
                    <div className="sfc-meta">
                      <strong>{post.songTitle}</strong>
                      <span>{post.artistName}</span>
                    </div>
                  </div>

                  <div className="sfc-lyrics">
                    {post.lines.map((l, idx) => (
                      <div key={idx} className="sfc-line-wrap">
                        <p className="sfc-lyric-line">{l.text}</p>
                        {l.translation && <p className="sfc-lyric-trans">{l.translation}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="sfc-brand">
                    <MimixMark size={18} monochrome />
                    <span>MIMIX</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="feed-post-actions">
                <button
                  type="button"
                  className={`feed-action-btn ${post.likedByMe ? 'liked' : ''}`}
                  onClick={() => onToggleLike(post.id)}
                >
                  <Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} />
                  <span>{post.likes}</span>
                </button>
                <button
                  type="button"
                  className="feed-action-btn"
                  onClick={() => onSelectSong(post.songId)}
                >
                  <MessageCircle size={16} />
                  <span>Abrir Letra</span>
                </button>
                <button
                  type="button"
                  className="feed-action-btn"
                  onClick={() => handleSharePost(post)}
                >
                  <Share2 size={16} />
                  <span>{copiedId === post.id ? 'Copiado!' : 'Partilhar'}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
