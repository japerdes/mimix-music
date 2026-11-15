import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Disc3,
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Pause,
  Play,
  Search,
  Share2,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import { LyricLine, Song } from '../types/music';
import { FeedPost } from './FeedView';
import { MimixMark, drawMimixMarkOnCanvas } from './MimixLogo';
import { fetchRealLyrics } from '../utils/lyricsApi';

interface LyricCardModalProps {
  song: Song;
  lines?: LyricLine[];
  initialLines?: string[];
  onClose: () => void;
  onPostToFeed?: (post: FeedPost) => void;
}

type CardTemplate = 'spotify' | 'glass' | 'polaroid' | 'neon' | 'vinyl' | 'editorial' | 'player';
type CardAspect = '4:5' | '9:16' | '1:1';
type CardFont = 'serif' | 'sans' | 'mono';

interface CardTheme {
  id: string;
  name: string;
  bg: string;
  fg: string;
  accent: string;
  grad: [string, string];
  isLight?: boolean;
}

const TEMPLATES: { id: CardTemplate; name: string; desc: string }[] = [
  { id: 'spotify', name: 'Card Clássico', desc: 'Estilo Spotify limpo' },
  { id: 'glass', name: 'Capa & Vidro', desc: 'Fundo desfocado' },
  { id: 'polaroid', name: 'Polaroid', desc: 'Foto & legenda' },
  { id: 'neon', name: 'Palco Neon', desc: 'Luz & destaque' },
  { id: 'vinyl', name: 'Vinil Retrô', desc: 'Disco & selo' },
  { id: 'editorial', name: 'Revista', desc: 'Pôster editorial' },
  { id: 'player', name: 'Streaming', desc: 'Player & barra' },
];

const ASPECTS: { id: CardAspect; label: string; w: number; h: number }[] = [
  { id: '4:5', label: 'Feed 4:5', w: 1080, h: 1350 },
  { id: '9:16', label: 'Stories 9:16', w: 1080, h: 1920 },
  { id: '1:1', label: 'Quadrado 1:1', w: 1080, h: 1080 },
];

const FONTS: { id: CardFont; label: string; css: string; canvas: string }[] = [
  { id: 'serif', label: 'Editorial', css: '"Fraunces", Georgia, serif', canvas: '"Fraunces", Georgia, serif' },
  { id: 'sans', label: 'Moderna', css: '"Plus Jakarta Sans", system-ui, sans-serif', canvas: '"Plus Jakarta Sans", sans-serif' },
  { id: 'mono', label: 'Estúdio', css: '"JetBrains Mono", monospace', canvas: '"JetBrains Mono", monospace' },
];

function formatDurationShort(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function loadCoverImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const out: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      out.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) out.push(current);
  return out;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shadeHex(hex: string, pct: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(2.55 * pct)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(2.55 * pct)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(2.55 * pct)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function isBrightHex(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

export const LyricCardModal: React.FC<LyricCardModalProps> = ({
  song,
  lines,
  initialLines,
  onClose,
  onPostToFeed,
}) => {
  const [fetchedLines, setFetchedLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    const base = lines && lines.length > 0 ? lines : song.lines || [];
    if (base.filter((l) => !l.isSection && l.text.trim().length > 0).length > 0) {
      setFetchedLines([]);
      return;
    }
    let cancelled = false;
    fetchRealLyrics(song.id, song.title, song.artistName, song.chordProgression || ['Am', 'F', 'C', 'G']).then(
      (res) => {
        if (!cancelled && res.lines.length > 0) {
          setFetchedLines(res.lines);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [song.id, song.title, song.artistName, song.chordProgression, song.lines, lines]);

  const sourceLines = useMemo(() => {
    const raw =
      lines && lines.length > 0
        ? lines
        : song.lines && song.lines.length > 0
          ? song.lines
          : fetchedLines;
    return (raw || []).filter((l) => !l.isSection && l.text.trim().length > 0);
  }, [lines, song.lines, fetchedLines]);

  const themes: CardTheme[] = useMemo(
    () => [
      {
        id: 'teal',
        name: 'Petróleo',
        bg: '#146d83',
        fg: '#0B1316',
        accent: '#1d8da8',
        grad: ['#146d83', '#0e5263'],
      },
      {
        id: 'terracota',
        name: 'Terracota',
        bg: '#b24940',
        fg: '#140908',
        accent: '#d16258',
        grad: ['#b24940', '#8d362f'],
      },
      {
        id: 'album',
        name: 'Cor da Capa',
        bg: '#0E0E12',
        fg: '#FAF8F5',
        accent: song.accentColor || '#FF6B3D',
        grad: ['#1A1822', '#09090D'],
      },
      {
        id: 'obsidian',
        name: 'Obsidian',
        bg: '#111113',
        fg: '#F5F2EB',
        accent: '#FF6B3D',
        grad: ['#221D1A', '#09090B'],
      },
      {
        id: 'aurora',
        name: 'Aurora Neon',
        bg: '#0F172A',
        fg: '#F0F9FF',
        accent: '#38BDF8',
        grad: ['#312E81', '#090D16'],
      },
      {
        id: 'emerald',
        name: 'Esmeralda',
        bg: '#064E3B',
        fg: '#ECFDF5',
        accent: '#34D399',
        grad: ['#065F46', '#021E17'],
      },
      {
        id: 'crimson',
        name: 'Rubi',
        bg: '#450A0A',
        fg: '#FFF1F2',
        accent: '#FB7185',
        grad: ['#881337', '#1C040A'],
      },
      {
        id: 'paper',
        name: 'Papel',
        bg: '#F4EFE6',
        fg: '#18181B',
        accent: '#EA580C',
        grad: ['#F7F3EB', '#E6DFD3'],
        isLight: true,
      },
      {
        id: 'cobalt',
        name: 'Cobalto',
        bg: '#1D4ED8',
        fg: '#EFF6FF',
        accent: '#3B82F6',
        grad: ['#1E40AF', '#172554'],
      },
      {
        id: 'lavender',
        name: 'Lavanda',
        bg: '#6D28D9',
        fg: '#F5F3FF',
        accent: '#8B5CF6',
        grad: ['#5B21B6', '#2E1065'],
      },
      {
        id: 'gold',
        name: 'Ouro Solar',
        bg: '#B45309',
        fg: '#181004',
        accent: '#D97706',
        grad: ['#B45309', '#78350F'],
      },
      {
        id: 'rose',
        name: 'Rosa Pop',
        bg: '#BE185D',
        fg: '#FFF1F2',
        accent: '#EC4899',
        grad: ['#9D174D', '#500724'],
      },
      {
        id: 'mint',
        name: 'Menta',
        bg: '#0D9488',
        fg: '#042F2E',
        accent: '#2DD4BF',
        grad: ['#0F766E', '#134E4A'],
      },
      {
        id: 'slate',
        name: 'Grafite',
        bg: '#27272A',
        fg: '#FAFAFA',
        accent: '#52525B',
        grad: ['#3F3F46', '#18181B'],
      },
      {
        id: 'wine',
        name: 'Vinho Jazz',
        bg: '#581C87',
        fg: '#FAF5FF',
        accent: '#9333EA',
        grad: ['#4C1D95', '#1E1B4B'],
      },
      {
        id: 'forest',
        name: 'Floresta',
        bg: '#14532D',
        fg: '#F0FDF4',
        accent: '#22C55E',
        grad: ['#166534', '#052E16'],
      },
    ],
    [song.accentColor]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialLines && initialLines.length > 0) {
      const valid = initialLines.filter((id) => sourceLines.some((l) => l.id === id));
      if (valid.length > 0) return valid.slice(0, 4);
    }
    return sourceLines.slice(0, 3).map((l) => l.id);
  });

  useEffect(() => {
    if (sourceLines.length > 0 && selectedIds.length === 0) {
      setSelectedIds(sourceLines.slice(0, Math.min(3, sourceLines.length)).map((l) => l.id));
    }
  }, [sourceLines, selectedIds.length]);

  const [template, setTemplate] = useState<CardTemplate>('spotify');
  const [studioTab, setStudioTab] = useState<'trecho' | 'visual' | 'partilhar'>('trecho');
  const [aspect, setAspect] = useState<CardAspect>('4:5');
  const [themeId, setThemeId] = useState<string>('teal');
  const [customColor, setCustomColor] = useState<string>('#2563EB');
  const [fontId, setFontId] = useState<CardFont>('sans');
  const [feedCaption, setFeedCaption] = useState<string>('');
  const [postedToFeed, setPostedToFeed] = useState<boolean>(false);
  const [showTranslation, setShowTranslation] = useState<boolean>(song.language !== 'pt');
  const [showCover, setShowCover] = useState<boolean>(true);
  const [showWaveform, setShowWaveform] = useState<boolean>(true);
  const [verseFilter, setVerseFilter] = useState<string>('');
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [copiedImg, setCopiedImg] = useState<boolean>(false);
  const [sharedLink, setSharedLink] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'webm'>('mp4');
  const [recordingVideo, setRecordingVideo] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [videoDoneMsg, setVideoDoneMsg] = useState<string>('');
  const recordStopRef = useRef<(() => void) | null>(null);

  // Audio Snippet Selection & Preview
  const [snippetStart, setSnippetStart] = useState<number>(0);
  const [snippetEnd, setSnippetEnd] = useState<number>(18);
  const [snippetPlaying, setSnippetPlaying] = useState<boolean>(false);
  const [snippetNow, setSnippetNow] = useState<number>(0);
  const snippetAudioRef = useRef<HTMLAudioElement | null>(null);

  const theme: CardTheme = useMemo(() => {
    if (themeId === 'custom') {
      const bright = isBrightHex(customColor);
      return {
        id: 'custom',
        name: 'Personalizada',
        bg: customColor,
        fg: bright ? '#0C0C0E' : '#FAF8F5',
        accent: shadeHex(customColor, 14),
        grad: [shadeHex(customColor, -10), shadeHex(customColor, -26)],
        isLight: bright,
      };
    }
    return themes.find((t) => t.id === themeId) || themes[0];
  }, [themeId, customColor, themes]);
  const aspectMeta = ASPECTS.find((a) => a.id === aspect) || ASPECTS[0];
  const fontMeta = FONTS.find((f) => f.id === fontId) || FONTS[0];

  const chosenLines = useMemo(
    () => sourceLines.filter((l) => selectedIds.includes(l.id)),
    [sourceLines, selectedIds]
  );

  useEffect(() => {
    if (chosenLines.length > 0) {
      const start = Math.max(0, Math.floor(chosenLines[0].time));
      const last = chosenLines[chosenLines.length - 1];
      const lastIdx = sourceLines.findIndex((l) => l.id === last.id);
      const nextLine = lastIdx >= 0 ? sourceLines[lastIdx + 1] : undefined;
      const end = nextLine
        ? Math.max(start + 6, Math.ceil(nextLine.time + 1))
        : Math.max(start + 10, Math.ceil(last.time + 6));
      setSnippetStart(start);
      setSnippetEnd(Math.min(song.duration || end, end));
      setSnippetNow(start);
    }
  }, [chosenLines, sourceLines, song.duration]);

  useEffect(() => {
    const audio = snippetAudioRef.current;
    if (!audio) return;
    if (snippetPlaying) {
      if (audio.currentTime < snippetStart || audio.currentTime >= snippetEnd) {
        audio.currentTime = snippetStart;
      }
      audio.play().catch(() => setSnippetPlaying(false));
    } else {
      audio.pause();
    }
  }, [snippetPlaying, snippetStart, snippetEnd]);

  useEffect(() => {
    if (!snippetPlaying) return;
    const timer = window.setInterval(() => {
      const audio = snippetAudioRef.current;
      if (!audio) return;
      setSnippetNow(audio.currentTime);
      if (audio.currentTime >= snippetEnd) {
        audio.currentTime = snippetStart;
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [snippetPlaying, snippetStart, snippetEnd]);

  const filteredSourceLines = useMemo(() => {
    const q = verseFilter.trim().toLowerCase();
    if (!q) return sourceLines;
    return sourceLines.filter(
      (l) =>
        l.text.toLowerCase().includes(q) ||
        (l.translation && l.translation.toLowerCase().includes(q))
    );
  }, [sourceLines, verseFilter]);

  const toggleLine = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      }
      if (prev.length >= 8) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const selectBlock = (count: number) => {
    const firstIdx = Math.max(
      0,
      sourceLines.findIndex((l) => selectedIds.includes(l.id))
    );
    const slice = sourceLines.slice(firstIdx, firstIdx + count).map((l) => l.id);
    if (slice.length > 0) setSelectedIds(slice);
  };

  const advanceBlock = () => {
    if (sourceLines.length === 0) return;
    const count = Math.max(1, selectedIds.length);
    const lastSelectedIdx = Math.max(
      0,
      ...selectedIds.map((id) => sourceLines.findIndex((l) => l.id === id))
    );
    const nextStart = lastSelectedIdx + 1 >= sourceLines.length ? 0 : lastSelectedIdx + 1;
    const slice = sourceLines.slice(nextStart, nextStart + count).map((l) => l.id);
    if (slice.length > 0) setSelectedIds(slice);
  };

  const renderCanvas = async (): Promise<HTMLCanvasElement> => {
    const W = aspectMeta.w;
    const H = aspectMeta.h;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const coverImg = showCover ? await loadCoverImage(song.coverImage || '') : null;

    const fgColor = template === 'polaroid' ? '#18181B' : theme.fg;

    // 1. Background
    if (template === 'polaroid') {
      ctx.fillStyle = '#F7F4EC';
      ctx.fillRect(0, 0, W, H);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, theme.grad[0]);
      bgGrad.addColorStop(1, theme.grad[1]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle ambient glow
      const glow = ctx.createRadialGradient(W * 0.25, H * 0.2, 40, W * 0.5, H * 0.5, W * 0.9);
      glow.addColorStop(0, theme.accent + '44');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    // If Glass template and cover image loaded, draw blurred cover backdrop
    if (template === 'glass' && coverImg) {
      ctx.save();
      ctx.filter = 'blur(42px) brightness(0.45) saturate(1.35)';
      const scale = Math.max(W / coverImg.width, H / coverImg.height) * 1.15;
      const dw = coverImg.width * scale;
      const dh = coverImg.height * scale;
      ctx.drawImage(coverImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    }

    // Special authentic Spotify-style floating card layout (better than Spotify: optional waveform & snippet badge)
    if (template === 'spotify') {
      const cardBg = theme.id === 'paper' ? '#FFFFFF' : theme.accent;
      const cardFg = theme.id === 'paper' || isBrightHex(cardBg) ? '#0C0C0E' : '#FAF8F5';
      const cardMuted = theme.id === 'paper' || isBrightHex(cardBg) ? 'rgba(12,12,14,0.72)' : 'rgba(250,248,245,0.76)';
      const cardW = W - (aspect === '1:1' ? 140 : 168);
      const cardX = (W - cardW) / 2;
      const cardPad = 60;
      const cardInnerW = cardW - cardPad * 2;

      const totalChars = chosenLines.reduce((acc, l) => acc + l.text.length, 0);
      let mainSize = aspect === '1:1' ? 42 : 46;
      if (chosenLines.length >= 7 || totalChars > 260) mainSize = 29;
      else if (chosenLines.length >= 5 || totalChars > 190) mainSize = 34;
      else if (chosenLines.length >= 3 || totalChars > 110) mainSize = 40;
      else if (chosenLines.length <= 2 && totalChars < 75) mainSize = 50;

      const mainLH = Math.round(mainSize * 1.24);
      const transSize = Math.round(mainSize * 0.56);
      const transLH = Math.round(transSize * 1.3);
      const gapBetween = chosenLines.length >= 6 ? 18 : 24;

      const blocks = chosenLines.map((line) => {
        ctx.font = `800 ${mainSize}px ${fontMeta.canvas}`;
        const mainWrapped = wrapTextLines(ctx, line.text, cardInnerW);
        let transWrapped: string[] = [];
        if (showTranslation && line.translation) {
          ctx.font = `600 ${transSize}px "Plus Jakarta Sans", sans-serif`;
          transWrapped = wrapTextLines(ctx, line.translation, cardInnerW);
        }
        const blockH =
          mainWrapped.length * mainLH +
          (transWrapped.length > 0 ? 6 + transWrapped.length * transLH : 0);
        return { mainWrapped, transWrapped, blockH };
      });

      const lyricsTotalH =
        blocks.reduce((sum, b) => sum + b.blockH, 0) +
        Math.max(0, blocks.length - 1) * gapBetween;

      const headerH = 104;
      const footerH = 56;
      const minCardH = Math.min(H - 160, Math.max(580, cardPad * 2 + headerH + 54 + lyricsTotalH + 54 + footerH));
      const cardH = aspect === '9:16' ? Math.max(minCardH, 860) : minCardH;
      const cardY = (H - cardH) / 2;

      // Floating card shadow & body
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.32)';
      ctx.shadowBlur = 52;
      ctx.shadowOffsetY = 22;
      drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 42);
      ctx.fillStyle = cardBg;
      ctx.fill();
      ctx.restore();

      // Subtle crisp rim
      ctx.save();
      drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 42);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isBrightHex(cardBg) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.14)';
      ctx.stroke();
      ctx.restore();

      const innerLeft = cardX + cardPad;
      const topY = cardY + cardPad;

      // Header: Square Cover + Bold Title + Artist
      const artSize = 100;
      if (showCover) {
        ctx.save();
        drawRoundedRect(ctx, innerLeft, topY, artSize, artSize, 16);
        ctx.clip();
        if (coverImg) {
          ctx.drawImage(coverImg, innerLeft, topY, artSize, artSize);
        } else {
          ctx.fillStyle = cardMuted;
          ctx.fillRect(innerLeft, topY, artSize, artSize);
        }
        ctx.restore();
      }

      const metaX = showCover ? innerLeft + artSize + 24 : innerLeft;
      const metaMaxW = cardX + cardW - cardPad - metaX;
      ctx.fillStyle = cardFg;
      ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
      const titleLine = wrapTextLines(ctx, song.title, metaMaxW)[0] || song.title;
      ctx.fillText(titleLine, metaX, topY + 42);

      ctx.fillStyle = cardMuted;
      ctx.font = '600 25px "Plus Jakarta Sans", sans-serif';
      const artistLine = wrapTextLines(ctx, song.artistName, metaMaxW)[0] || song.artistName;
      ctx.fillText(artistLine, metaX, topY + 80);

      // Lyrics centered vertically in middle area
      const bodyStart = topY + headerH + 36;
      const bodyEnd = cardY + cardH - cardPad - footerH - 24;
      let lyricY = bodyStart + Math.max(12, (bodyEnd - bodyStart - lyricsTotalH) / 2) + mainSize * 0.72;

      blocks.forEach((b) => {
        ctx.fillStyle = cardFg;
        ctx.font = `800 ${mainSize}px ${fontMeta.canvas}`;
        b.mainWrapped.forEach((txt) => {
          ctx.fillText(txt, innerLeft, lyricY);
          lyricY += mainLH;
        });
        if (b.transWrapped.length > 0) {
          lyricY += 4;
          ctx.fillStyle = cardMuted;
          ctx.font = `600 ${transSize}px "Plus Jakarta Sans", sans-serif`;
          b.transWrapped.forEach((txt) => {
            ctx.fillText(txt, innerLeft, lyricY);
            lyricY += transLH;
          });
        }
        lyricY += gapBetween;
      });

      // Footer: MIMIX mark on left + Mini Soundwave & Trecho badge on right
      const brandY = cardY + cardH - cardPad;
      drawMimixMarkOnCanvas(ctx, innerLeft + 16, brandY - 11, 16, cardFg);

      ctx.fillStyle = cardFg;
      ctx.font = '900 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('MIMIX', innerLeft + 42, brandY - 2);

      if (showWaveform) {
        const tag = `${formatDurationShort(snippetStart)}–${formatDurationShort(snippetEnd)}`;
        ctx.font = '700 20px "JetBrains Mono", monospace';
        const tagW = ctx.measureText(tag).width;
        const rightEdge = cardX + cardW - cardPad;
        ctx.fillStyle = cardMuted;
        ctx.fillText(tag, rightEdge - tagW, brandY - 4);

        const bars = 12;
        const barW = 5;
        const barGap = 5;
        const barsStartX = rightEdge - tagW - 16 - bars * (barW + barGap);
        for (let i = 0; i < bars; i++) {
          const h = 10 + Math.round(Math.abs(Math.sin(i * 0.8 + 0.6)) * 18);
          ctx.fillStyle = cardFg;
          drawRoundedRect(ctx, barsStartX + i * (barW + barGap), brandY - 10 - h / 2, barW, h, 3);
          ctx.fill();
        }
      }

      return canvas;
    }

    // Outer padding & card container for Glass / Player
    const pad = 76;
    if (template === 'glass') {
      ctx.save();
      drawRoundedRect(ctx, pad - 16, pad - 16, W - (pad - 16) * 2, H - (pad - 16) * 2, 44);
      ctx.fillStyle = theme.isLight ? 'rgba(255,255,255,0.72)' : 'rgba(14,14,18,0.58)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.16)';
      ctx.stroke();
      ctx.restore();
    } else if (template === 'editorial') {
      ctx.strokeStyle = theme.accent + '55';
      ctx.lineWidth = 3;
      ctx.strokeRect(48, 48, W - 96, H - 96);
    }

    const innerX = pad + 24;
    const innerW = W - (pad + 24) * 2;
    let cursorY = pad + 34;

    // 2. Top Header: Cover Art + Song/Artist OR Editorial Brand
    if (template === 'editorial') {
      ctx.fillStyle = theme.accent;
      ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('MIMIX  •  ESTÚDIO EDITORIAL', innerX, cursorY + 18);
      ctx.fillStyle = theme.fg + '66';
      ctx.font = '600 22px "JetBrains Mono", monospace';
      const metaRight = `${song.year} • ${song.bpm} BPM`;
      const mw = ctx.measureText(metaRight).width;
      ctx.fillText(metaRight, W - innerX - mw, cursorY + 18);

      // Giant decorative quote
      ctx.fillStyle = theme.accent + '2E';
      ctx.font = '900 240px Georgia, serif';
      ctx.fillText('“', innerX - 18, cursorY + 210);
      cursorY += 150;
    } else {
      // Cover + Vinyl / Header
      const artSize = template === 'vinyl' ? 170 : 136;

      if (template === 'vinyl') {
        // Draw peeking vinyl disc to the right of the cover
        const discCx = innerX + artSize + 36;
        const discCy = cursorY + artSize / 2;
        const discR = artSize * 0.48;
        ctx.save();
        ctx.beginPath();
        ctx.arc(discCx, discCy, discR, 0, Math.PI * 2);
        ctx.fillStyle = '#09090B';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.stroke();
        // Grooves
        [0.82, 0.68, 0.54].forEach((r) => {
          ctx.beginPath();
          ctx.arc(discCx, discCy, discR * r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
        // Center label
        ctx.beginPath();
        ctx.arc(discCx, discCy, discR * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = theme.accent;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(discCx, discCy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#09090B';
        ctx.fill();
        ctx.restore();
      }

      if (showCover) {
        ctx.save();
        drawRoundedRect(ctx, innerX, cursorY, artSize, artSize, 22);
        ctx.clip();
        if (coverImg) {
          ctx.drawImage(coverImg, innerX, cursorY, artSize, artSize);
        } else {
          const cg = ctx.createLinearGradient(innerX, cursorY, innerX + artSize, cursorY + artSize);
          cg.addColorStop(0, theme.accent);
          cg.addColorStop(1, theme.grad[1]);
          ctx.fillStyle = cg;
          ctx.fillRect(innerX, cursorY, artSize, artSize);
        }
        ctx.restore();
      }

      const textX = showCover ? innerX + artSize + (template === 'vinyl' ? 115 : 32) : innerX;
      ctx.fillStyle = theme.fg;
      ctx.font = '800 38px "Plus Jakarta Sans", sans-serif';
      const titleLines = wrapTextLines(ctx, song.title, W - textX - innerX);
      ctx.fillText(titleLines[0] || song.title, textX, cursorY + 52);

      ctx.fillStyle = theme.fg + 'CC';
      ctx.font = '600 27px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(song.artistName, textX, cursorY + 94);

      ctx.fillStyle = theme.accent;
      ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${song.album.toUpperCase()} • ${song.year}`, textX, cursorY + 130);

      cursorY += artSize + (aspect === '9:16' ? 110 : 64);
    }

    // 3. Lyrics Body (Centered vertically in remaining space)
    const footerHeight = showWaveform ? 210 : 140;
    const availableH = H - pad - footerHeight - cursorY;

    // Determine font size based on verse count & aspect
    const totalChars = chosenLines.reduce((acc, l) => acc + l.text.length, 0);
    let mainSize = aspect === '1:1' ? 42 : 48;
    if (chosenLines.length >= 4 || totalChars > 170) mainSize = 36;
    else if (chosenLines.length <= 2 && totalChars < 85) mainSize = 56;
    const mainLH = Math.round(mainSize * 1.32);
    const transSize = Math.round(mainSize * 0.62);
    const transLH = Math.round(transSize * 1.36);

    // Pre-calculate blocks so we can center them nicely
    const blocks = chosenLines.map((line) => {
      ctx.font = `700 ${mainSize}px ${fontMeta.canvas}`;
      const mainWrapped = wrapTextLines(ctx, `“${line.text}”`, innerW - (template === 'player' ? 40 : 0));
      let transWrapped: string[] = [];
      if (showTranslation && line.translation) {
        ctx.font = `500 ${transSize}px "Plus Jakarta Sans", sans-serif`;
        transWrapped = wrapTextLines(ctx, line.translation, innerW - (template === 'player' ? 40 : 0));
      }
      const blockH =
        mainWrapped.length * mainLH +
        (transWrapped.length > 0 ? 10 + transWrapped.length * transLH : 0);
      return { mainWrapped, transWrapped, blockH };
    });

    const gapBetween = 32;
    const totalLyricsH =
      blocks.reduce((sum, b) => sum + b.blockH, 0) +
      Math.max(0, blocks.length - 1) * gapBetween;

    let lyricY = cursorY + Math.max(16, (availableH - totalLyricsH) / 2);

    blocks.forEach((b) => {
      if (template === 'player') {
        ctx.save();
        drawRoundedRect(ctx, innerX - 18, lyricY - mainSize + 6, innerW + 36, b.blockH + 22, 20);
        ctx.fillStyle = theme.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.restore();
      } else if (template === 'neon') {
        ctx.fillStyle = theme.accent;
        drawRoundedRect(ctx, innerX - 22, lyricY - mainSize + 10, 8, b.blockH + 6, 4);
        ctx.fill();
      }

      ctx.fillStyle = fgColor;
      ctx.font = `700 ${mainSize}px ${fontMeta.canvas}`;
      b.mainWrapped.forEach((txt) => {
        ctx.fillText(txt, innerX, lyricY);
        lyricY += mainLH;
      });

      if (b.transWrapped.length > 0) {
        lyricY += 6;
        ctx.fillStyle = theme.fg + 'B0';
        ctx.font = `500 ${transSize}px "Plus Jakarta Sans", sans-serif`;
        b.transWrapped.forEach((txt) => {
          ctx.fillText(txt, innerX, lyricY);
          lyricY += transLH;
        });
      }
      lyricY += gapBetween;
    });

    // 4. Footer: Waveform / Scrubber + Brand Stamp
    const footerY = H - pad - (showWaveform ? 120 : 60);

    if (showWaveform) {
      if (template === 'player') {
        // Progress scrubber bar
        const barY = footerY;
        ctx.fillStyle = theme.fg + '26';
        drawRoundedRect(ctx, innerX, barY, innerW, 8, 4);
        ctx.fill();

        ctx.fillStyle = theme.accent;
        drawRoundedRect(ctx, innerX, barY, innerW * 0.42, 8, 4);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(innerX + innerW * 0.42, barY + 4, 12, 0, Math.PI * 2);
        ctx.fillStyle = theme.fg;
        ctx.fill();

        ctx.fillStyle = theme.fg + '99';
        ctx.font = '600 20px "JetBrains Mono", monospace';
        ctx.fillText(formatDurationShort(chosenLines[0]?.time || 48), innerX, barY + 38);
        const durTxt = formatDurationShort(song.duration || 210);
        ctx.fillText(durTxt, W - innerX - ctx.measureText(durTxt).width, barY + 38);
      } else {
        // Soundwave bars
        const bars = 46;
        const barW = 8;
        const gap = (innerW - bars * barW) / (bars - 1);
        for (let i = 0; i < bars; i++) {
          const h = 14 + Math.round(Math.abs(Math.sin(i * 0.65 + 1.2)) * 34);
          const bx = innerX + i * (barW + gap);
          const by = footerY + (48 - h) / 2;
          ctx.fillStyle = i < bars * 0.45 ? theme.accent : theme.fg + '38';
          drawRoundedRect(ctx, bx, by, barW, h, 4);
          ctx.fill();
        }
      }
    }

    // Bottom Brand Row
    const brandY = H - pad - 14;
    ctx.fillStyle = theme.accent;
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('MIMIX', innerX, brandY);
    const versoW = ctx.measureText('MIMIX').width;

    ctx.fillStyle = theme.fg + '88';
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    const snippetTag = `  •  Trecho ${formatDurationShort(snippetStart)}–${formatDurationShort(snippetEnd)}`;
    ctx.fillText(
      template === 'editorial'
        ? `  •  ${song.title} — ${song.artistName}${snippetTag}`
        : `${snippetTag}  •  mimix.music`,
      innerX + versoW,
      brandY
    );

    return canvas;
  };

  const handleDownloadPng = async () => {
    setExporting(true);
    try {
      const canvas = await renderCanvas();
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.id}-verso-${aspect.replace(':', 'x')}.png`;
      a.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyImage = async () => {
    setExporting(true);
    try {
      const canvas = await renderCanvas();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImg(true);
        setTimeout(() => setCopiedImg(false), 2500);
      }
    } catch {
      // Fallback to download if clipboard image write is blocked
      await handleDownloadPng();
    } finally {
      setExporting(false);
    }
  };

  const handleExportVideo = async (autoShare = false) => {
    if (recordingVideo) {
      recordStopRef.current?.();
      return;
    }

    setRecordingVideo(true);
    setVideoProgress(0);
    setVideoDoneMsg('');

    const durationSec = Math.max(4, Math.min(25, snippetEnd - snippetStart));
    const W = aspectMeta.w === 1080 ? 720 : aspectMeta.w;
    const H = Math.round((aspectMeta.h / aspectMeta.w) * W);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const coverImg = showCover ? await loadCoverImage(song.coverImage || '') : null;

    // Pick supported MIME type based on user's chosen format
    const mp4Candidates = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ];
    const webmCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const candidates =
      videoFormat === 'mp4' ? [...mp4Candidates, ...webmCandidates] : [...webmCandidates, ...mp4Candidates];
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

    const streamUrl = `/api/stream?q=${encodeURIComponent(`${song.artistName} ${song.title} Topic`)}`;
    const recAudio = new Audio(streamUrl);
    recAudio.crossOrigin = 'anonymous';

    let audioCtx: AudioContext | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          recAudio.removeEventListener('canplay', onReady);
          recAudio.removeEventListener('error', onErr);
          resolve();
        };
        const onErr = () => {
          recAudio.removeEventListener('canplay', onReady);
          recAudio.removeEventListener('error', onErr);
          reject(new Error('Audio load failed'));
        };
        recAudio.addEventListener('canplay', onReady);
        recAudio.addEventListener('error', onErr);
        recAudio.load();
        window.setTimeout(resolve, 4500);
      });

      recAudio.currentTime = snippetStart;
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(recAudio);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination);

      const videoStream = canvas.captureStream(30);
      dest.stream.getAudioTracks().forEach((t) => videoStream.addTrack(t));

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(videoStream, {
        mimeType,
        videoBitsPerSecond: 3_500_000,
      });

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const drawFrame = (elapsed: number) => {
        const progress = Math.min(1, elapsed / durationSec);
        const currentAudioT = snippetStart + elapsed;

        // Animated background
        if (template === 'polaroid') {
          ctx.fillStyle = '#F7F4EC';
          ctx.fillRect(0, 0, W, H);
        } else {
          const bgGrad = ctx.createLinearGradient(0, 0, W, H);
          bgGrad.addColorStop(0, theme.grad[0]);
          bgGrad.addColorStop(1, theme.grad[1]);
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, W, H);

          // Pulsing stage glow
          const gx = W * (0.3 + 0.18 * Math.sin(elapsed * 1.3));
          const gy = H * (0.25 + 0.12 * Math.cos(elapsed * 1.1));
          const glow = ctx.createRadialGradient(gx, gy, 30, W * 0.5, H * 0.5, W * 0.95);
          glow.addColorStop(0, theme.accent + '55');
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, W, H);
        }

        if (template === 'glass' && coverImg) {
          ctx.save();
          ctx.filter = 'blur(30px) brightness(0.42) saturate(1.35)';
          const sc = Math.max(W / coverImg.width, H / coverImg.height) * 1.15;
          ctx.drawImage(coverImg, (W - coverImg.width * sc) / 2, (H - coverImg.height * sc) / 2, coverImg.width * sc, coverImg.height * sc);
          ctx.restore();
        }

        const pad = Math.round(W * 0.07);
        const fgColor = template === 'polaroid' ? '#18181B' : theme.fg;
        if (template === 'glass') {
          ctx.save();
          drawRoundedRect(ctx, pad - 10, pad - 10, W - (pad - 10) * 2, H - (pad - 10) * 2, 30);
          ctx.fillStyle = theme.isLight ? 'rgba(255,255,255,0.72)' : 'rgba(14,14,18,0.6)';
          ctx.fill();
          ctx.restore();
        }

        const innerX = pad + 18;
        const innerW = W - innerX * 2;
        let y = pad + 24;

        // Cover + Song Title + Artist Name (always prominent!)
        const artSize = Math.round(W * 0.14);
        if (showCover && coverImg) {
          ctx.save();
          drawRoundedRect(ctx, innerX, y, artSize, artSize, 14);
          ctx.clip();
          ctx.drawImage(coverImg, innerX, y, artSize, artSize);
          ctx.restore();
        }
        const tx = showCover && coverImg ? innerX + artSize + 20 : innerX;
        ctx.fillStyle = fgColor;
        ctx.font = `800 ${Math.round(W * 0.036)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(song.title, tx, y + Math.round(artSize * 0.42));
        ctx.fillStyle = fgColor + 'CC';
        ctx.font = `600 ${Math.round(W * 0.026)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(song.artistName, tx, y + Math.round(artSize * 0.78));

        y += artSize + Math.round(H * 0.06);

        // Lyrics with live highlight as audio plays
        const mainSz = Math.round(W * 0.044);
        const lh = Math.round(mainSz * 1.32);
        const transSz = Math.round(mainSz * 0.62);
        const transLh = Math.round(transSz * 1.32);

        const activeLine = chosenLines.reduce<string | null>(
          (acc, l) => (currentAudioT >= l.time ? l.id : acc),
          chosenLines[0]?.id || null
        );

        chosenLines.forEach((line) => {
          const isLit = line.id === activeLine;
          ctx.fillStyle = isLit ? fgColor : fgColor + '70';
          ctx.font = `700 ${mainSz}px ${fontMeta.canvas}`;
          const wrapped = wrapTextLines(ctx, `“${line.text}”`, innerW);
          wrapped.forEach((wLine) => {
            ctx.fillText(wLine, innerX, y);
            y += lh;
          });
          if (showTranslation && line.translation) {
            ctx.fillStyle = isLit ? fgColor + 'CC' : fgColor + '55';
            ctx.font = `500 ${transSz}px "Plus Jakarta Sans", sans-serif`;
            const tWrapped = wrapTextLines(ctx, line.translation, innerW);
            tWrapped.forEach((tLine) => {
              ctx.fillText(tLine, innerX, y);
              y += transLh;
            });
          }
          y += Math.round(mainSz * 0.5);
        });

        // Animated Soundwave + Live Progress Scrubber
        const waveY = H - pad - 88;
        const bars = 40;
        const barW = 6;
        const gap = (innerW - bars * barW) / (bars - 1);
        for (let i = 0; i < bars; i++) {
          const bh = 10 + Math.round(Math.abs(Math.sin(i * 0.6 + elapsed * 6.5)) * 28);
          const bx = innerX + i * (barW + gap);
          const by = waveY + (38 - bh) / 2;
          ctx.fillStyle = i / bars <= progress ? theme.accent : fgColor + '38';
          drawRoundedRect(ctx, bx, by, barW, bh, 3);
          ctx.fill();
        }

        // Bottom Brand + Song/Artist + Time
        const brandY = H - pad - 14;
        ctx.fillStyle = theme.accent;
        ctx.font = `800 ${Math.round(W * 0.022)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText('MIMIX', innerX, brandY);
        const vw = ctx.measureText('MIMIX').width;
        ctx.fillStyle = fgColor + '99';
        ctx.font = `600 ${Math.round(W * 0.02)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(
          `  •  ${song.title} — ${song.artistName}  (${formatDurationShort(currentAudioT)})`,
          innerX + vw,
          brandY
        );
      };

      let rafId = 0;
      let stopped = false;
      const startTime = performance.now();

      const stopRecording = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(rafId);
        recAudio.pause();
        if (recorder.state !== 'inactive') recorder.stop();
      };
      recordStopRef.current = stopRecording;

      recorder.onstop = async () => {
        audioCtx?.close().catch(() => {});
        const blob = new Blob(chunks, { type: mimeType });
        const fileName = `${song.id}-verso-${aspect.replace(':', 'x')}.${ext}`;
        const file = new File([blob], fileName, { type: mimeType });

        if (autoShare && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${song.title} — ${song.artistName}`,
              text: `${chosenLines.map((l) => `“${l.text}”`).join('\n')} — ${song.title}, ${song.artistName}`,
            });
            setVideoDoneMsg(`Vídeo ${ext.toUpperCase()} partilhado!`);
            setRecordingVideo(false);
            return;
          } catch {
            // fallback to download
          }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        setVideoDoneMsg(`Vídeo ${ext.toUpperCase()} com áudio baixado!`);
        setRecordingVideo(false);
      };

      recorder.start(200);
      await recAudio.play().catch(() => {});

      const tick = () => {
        if (stopped) return;
        const elapsed = (performance.now() - startTime) / 1000;
        drawFrame(elapsed);
        setVideoProgress(Math.min(100, Math.round((elapsed / durationSec) * 100)));
        if (elapsed >= durationSec) {
          stopRecording();
        } else {
          rafId = requestAnimationFrame(tick);
        }
      };
      rafId = requestAnimationFrame(tick);
    } catch {
      audioCtx?.close().catch(() => {});
      setRecordingVideo(false);
    }
  };

  const handleShareSnippet = async () => {
    const shareUrl = `${window.location.origin}/?song=${encodeURIComponent(
      song.id
    )}&t=${Math.floor(snippetStart)}&end=${Math.ceil(snippetEnd)}`;
    const quoteText = chosenLines.map((l) => `“${l.text}”`).join('\n');
    const shareText = `${quoteText}\n— ${song.title}, ${song.artistName} (${formatDurationShort(
      snippetStart
    )}–${formatDurationShort(snippetEnd)})`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${song.title} — ${song.artistName} | MIMIX`,
          text: shareText,
          url: shareUrl,
        });
        setSharedLink(true);
        setTimeout(() => setSharedLink(false), 2500);
        return;
      } catch {
        // user cancelled or fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setSharedLink(true);
      setTimeout(() => setSharedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const waveHeights = useMemo(
    () => Array.from({ length: 34 }, (_, i) => 22 + Math.round(Math.abs(Math.sin(i * 0.7 + 1.1)) * 75)),
    []
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel card-studio-modal-v2" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Sparkles size={20} className="accent-icon" />
            <div>
              <h2>Estúdio de Lyric Card</h2>
              <span className="modal-subtitle">
                {song.title} • {song.artistName}
              </span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="card-studio-v2-grid">
          {/* Left Controls */}
          <div className="card-studio-v2-controls">
            <audio
              ref={snippetAudioRef}
              src={`/api/stream?q=${encodeURIComponent(`${song.artistName} ${song.title} Topic`)}`}
              preload="metadata"
              onError={(e) => {
                const el = e.currentTarget;
                if (song.previewUrl && el.src !== song.previewUrl) {
                  el.src = song.previewUrl;
                }
              }}
            />

            <div className="card-studio-tabs">
              <button
                type="button"
                className={`cs-tab-btn ${studioTab === 'trecho' ? 'active' : ''}`}
                onClick={() => setStudioTab('trecho')}
              >
                1. Letra & Trecho
              </button>
              <button
                type="button"
                className={`cs-tab-btn ${studioTab === 'visual' ? 'active' : ''}`}
                onClick={() => setStudioTab('visual')}
              >
                2. Visual & Cores
              </button>
              <button
                type="button"
                className={`cs-tab-btn ${studioTab === 'partilhar' ? 'active' : ''}`}
                onClick={() => setStudioTab('partilhar')}
              >
                3. Postar & Vídeo
              </button>
            </div>

            {studioTab === 'visual' && (
              <>
            {/* Step 1: Template */}
            <div className="control-group">
              <label className="control-label-icon">
                <Layers size={14} /> Estilo do Card
              </label>
              <div className="template-grid">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`template-pill ${template === tpl.id ? 'active' : ''}`}
                    onClick={() => setTemplate(tpl.id)}
                  >
                    <strong>{tpl.name}</strong>
                    <span>{tpl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Aspect + Font */}
            <div className="control-split">
              <div className="control-group">
                <label className="control-label-icon">
                  <ImageIcon size={14} /> Formato
                </label>
                <div className="mini-segment">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`segment-btn ${aspect === a.id ? 'active' : ''}`}
                      onClick={() => setAspect(a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <label className="control-label-icon">
                  <Type size={14} /> Tipografia
                </label>
                <div className="mini-segment">
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`segment-btn ${fontId === f.id ? 'active' : ''}`}
                      onClick={() => setFontId(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Theme */}
            <div className="control-group">
              <label className="control-label-icon">
                <Palette size={14} /> Paleta de Cores
              </label>
              <div className="theme-swatches-v2">
                {themes.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className={`theme-swatch-v2 ${t.id === themeId ? 'active' : ''}`}
                    onClick={() => setThemeId(t.id)}
                  >
                    <span
                      className="swatch-dot"
                      style={{
                        background: `linear-gradient(135deg, ${t.grad[0]}, ${t.accent})`,
                      }}
                    />
                    <span>{t.name}</span>
                  </button>
                ))}
                <label
                  className={`theme-swatch-v2 ${themeId === 'custom' ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                  title="Escolher qualquer cor personalizada"
                >
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setThemeId('custom');
                    }}
                    style={{
                      width: '16px',
                      height: '16px',
                      border: 'none',
                      padding: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                  <span>Cor Livre</span>
                </label>
              </div>
            </div>

            {/* Toggles */}
            <div className="card-toggles-row">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showTranslation}
                  onChange={(e) => setShowTranslation(e.target.checked)}
                />
                <span>Tradução</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showCover}
                  onChange={(e) => setShowCover(e.target.checked)}
                />
                <span>Capa</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showWaveform}
                  onChange={(e) => setShowWaveform(e.target.checked)}
                />
                <span>Onda sonora</span>
              </label>
            </div>
              </>
            )}

            {studioTab === 'trecho' && (
              <>
            {/* Step 4: Verse Picker */}
            <div className="control-group">
              <div className="verse-picker-head">
                <label>Versos ({selectedIds.length}/8 selecionados)</label>
                <div className="verse-quick-btns">
                  <button type="button" className="mini-btn" onClick={() => selectBlock(1)}>
                    1
                  </button>
                  <button type="button" className="mini-btn" onClick={() => selectBlock(2)}>
                    2
                  </button>
                  <button type="button" className="mini-btn" onClick={() => selectBlock(4)}>
                    4
                  </button>
                  <button type="button" className="mini-btn" onClick={() => selectBlock(6)}>
                    6
                  </button>
                  <button type="button" className="mini-btn" onClick={() => selectBlock(8)}>
                    8
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    title="Avançar para o próximo trecho"
                    onClick={advanceBlock}
                  >
                    Próx.
                  </button>
                </div>
              </div>

              {sourceLines.length > 8 && (
                <div className="verse-search-box">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Filtrar versos da letra..."
                    value={verseFilter}
                    onChange={(e) => setVerseFilter(e.target.value)}
                  />
                </div>
              )}

              <div className="line-picker-list">
                {filteredSourceLines.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1rem' }}>
                    {sourceLines.length === 0
                      ? 'Aguardando carregamento da letra...'
                      : 'Nenhum verso encontrado para o filtro.'}
                  </div>
                ) : (
                  filteredSourceLines.map((line) => {
                    const active = selectedIds.includes(line.id);
                    return (
                      <button
                        type="button"
                        key={line.id}
                        className={`line-picker-item ${active ? 'active' : ''}`}
                        onClick={() => toggleLine(line.id)}
                      >
                        <div className="lpi-texts">
                          <span>{line.text}</span>
                          {line.translation && <small>{line.translation}</small>}
                        </div>
                        {active && <Check size={15} className="accent-icon" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 6: Audio Snippet Preview & Fine-Tune (Spotify Style+) */}
            <div className="snippet-studio-box">
              <div className="snippet-box-top">
                <button
                  type="button"
                  className="snippet-play-btn"
                  onClick={() => setSnippetPlaying((p) => !p)}
                >
                  {snippetPlaying ? <Pause size={15} /> : <Play size={15} />}
                  <span>{snippetPlaying ? 'Pausar Trecho' : 'Ouvir Trecho'}</span>
                </button>
                <span className="mono-time">
                  {formatDurationShort(snippetPlaying ? snippetNow : snippetStart)} /{' '}
                  {formatDurationShort(snippetStart)}–{formatDurationShort(snippetEnd)}
                </span>
              </div>
              <div className="snippet-nudge-row">
                <div className="nudge-group">
                  <span>Início:</span>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setSnippetStart((s) => Math.max(0, s - 2))}
                  >
                    -2s
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setSnippetStart((s) => Math.min(snippetEnd - 3, s + 2))}
                  >
                    +2s
                  </button>
                </div>
                <div className="nudge-group">
                  <span>Fim:</span>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setSnippetEnd((e) => Math.max(snippetStart + 3, e - 2))}
                  >
                    -2s
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() =>
                      setSnippetEnd((e) => Math.min(song.duration || e + 2, e + 2))
                    }
                  >
                    +2s
                  </button>
                </div>
              </div>
            </div>
              </>
            )}

            {studioTab === 'partilhar' && (
              <>
            {/* Postar no Feed do VERSO */}
            {onPostToFeed && (
              <div className="post-feed-box">
                <input
                  type="text"
                  className="feed-caption-input"
                  value={feedCaption}
                  onChange={(e) => setFeedCaption(e.target.value)}
                  placeholder="Legenda opcional para o Feed (ex: Essa parte arrepia...)"
                />
                <button
                  type="button"
                  className="primary-btn"
                  disabled={chosenLines.length === 0 || postedToFeed}
                  onClick={() => {
                    onPostToFeed({
                      id: `post-${Date.now()}`,
                      author: 'Você',
                      caption: feedCaption.trim() || undefined,
                      createdAt: 'Agora mesmo',
                      songId: song.id,
                      songTitle: song.title,
                      artistName: song.artistName,
                      coverImage: song.coverImage,
                      lines: chosenLines.map((l) => ({
                        text: l.text,
                        translation: showTranslation ? l.translation : undefined,
                      })),
                      outerBg: theme.grad[0],
                      cardBg: theme.id === 'paper' ? '#FFFFFF' : theme.accent,
                      textColor: theme.id === 'paper' || isBrightHex(theme.accent) ? '#0C0C0E' : '#FAF8F5',
                      snippetStart,
                      snippetEnd,
                      likes: 1,
                      likedByMe: true,
                    });
                    setPostedToFeed(true);
                  }}
                >
                  <Sparkles size={16} />
                  <span>{postedToFeed ? 'Publicado no Feed!' : 'Postar no Feed do MIMIX'}</span>
                </button>
              </div>
            )}

            {/* Export Buttons */}
            <div className="card-export-actions-v2">
              <button
                type="button"
                className="primary-btn"
                onClick={handleDownloadPng}
                disabled={exporting || chosenLines.length === 0}
              >
                {downloaded ? <Check size={17} /> : <Download size={17} />}
                <span>{downloaded ? 'PNG Salvo!' : 'Baixar PNG'}</span>
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleCopyImage}
                disabled={exporting || chosenLines.length === 0}
              >
                {copiedImg ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedImg ? 'Copiado!' : 'Copiar'}</span>
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleShareSnippet}
                disabled={chosenLines.length === 0}
                title="Partilhar card com link para este trecho exato da música"
              >
                {sharedLink ? <Check size={16} /> : <Share2 size={16} />}
                <span>{sharedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>

            {/* Export Video with Audio */}
            <div className="video-export-box">
              <div className="video-export-head">
                <span className="control-label-icon">
                  <Film size={14} /> Vídeo Animado com Áudio ({Math.max(4, Math.min(25, snippetEnd - snippetStart))}s)
                </span>
                <div className="mini-segment" style={{ width: '130px' }}>
                  <button
                    type="button"
                    className={`segment-btn ${videoFormat === 'mp4' ? 'active' : ''}`}
                    onClick={() => setVideoFormat('mp4')}
                    disabled={recordingVideo}
                  >
                    MP4
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${videoFormat === 'webm' ? 'active' : ''}`}
                    onClick={() => setVideoFormat('webm')}
                    disabled={recordingVideo}
                  >
                    WebM
                  </button>
                </div>
              </div>
              <div className="video-export-btns">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => handleExportVideo(false)}
                  disabled={chosenLines.length === 0}
                >
                  {recordingVideo ? <Loader2 size={16} className="spin" /> : <Film size={16} />}
                  <span>
                    {recordingVideo
                      ? `Gravando ${videoProgress}% (Parar)`
                      : `Baixar Vídeo ${videoFormat.toUpperCase()} + Som`}
                  </span>
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => handleExportVideo(true)}
                  disabled={recordingVideo || chosenLines.length === 0}
                  title="Gravar vídeo com som e abrir menu de partilha"
                >
                  <Share2 size={16} />
                  <span>Partilhar Vídeo</span>
                </button>
              </div>
              {videoDoneMsg && <div className="video-done-note">{videoDoneMsg}</div>}
            </div>

            {/* Onde Partilhar */}
            <div className="share-destinations-row">
              <span className="share-dest-label">Partilhar em:</span>
              <button
                type="button"
                className="share-dest-pill"
                onClick={() => {
                  setAspect('9:16');
                  navigator.clipboard?.writeText(
                    `${chosenLines.map((l) => `“${l.text}”`).join('\n')}\n🎵 ${song.title} — ${song.artistName}`
                  );
                  handleExportVideo(false);
                }}
                title="Gera vídeo 9:16 com áudio e copia legenda com música e artista"
              >
                Instagram Stories / Reels
              </button>
              <button
                type="button"
                className="share-dest-pill"
                onClick={() => {
                  setAspect('9:16');
                  navigator.clipboard?.writeText(
                    `${chosenLines.map((l) => `“${l.text}”`).join(' ')} #${song.artistName.replace(/\s+/g, '')} #verso`
                  );
                  handleExportVideo(false);
                }}
              >
                TikTok
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `${chosenLines.map((l) => `“${l.text}”`).join('\n')}\n🎵 *${song.title}* — ${song.artistName}\n${window.location.origin}/?song=${encodeURIComponent(song.id)}&t=${Math.floor(snippetStart)}&end=${Math.ceil(snippetEnd)}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="share-dest-pill"
              >
                WhatsApp
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                  `${window.location.origin}/?song=${encodeURIComponent(song.id)}&t=${Math.floor(snippetStart)}&end=${Math.ceil(snippetEnd)}`
                )}&quote=${encodeURIComponent(
                  `${chosenLines.map((l) => `“${l.text}”`).join(' / ')} — ${song.title}, ${song.artistName}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="share-dest-pill"
              >
                Facebook
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `${chosenLines.map((l) => `“${l.text}”`).join(' / ')} — ${song.title}, ${song.artistName}`
                )}&url=${encodeURIComponent(
                  `${window.location.origin}/?song=${encodeURIComponent(song.id)}&t=${Math.floor(snippetStart)}&end=${Math.ceil(snippetEnd)}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="share-dest-pill"
              >
                X / Twitter
              </a>
              <a
                href={`https://www.threads.net/intent/post?text=${encodeURIComponent(
                  `${chosenLines.map((l) => `“${l.text}”`).join('\n')}\n🎵 ${song.title} — ${song.artistName}\n${window.location.origin}/?song=${encodeURIComponent(song.id)}&t=${Math.floor(snippetStart)}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="share-dest-pill"
              >
                Threads
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  `${window.location.origin}/?song=${encodeURIComponent(song.id)}&t=${Math.floor(snippetStart)}&end=${Math.ceil(snippetEnd)}`
                )}&text=${encodeURIComponent(
                  `${chosenLines.map((l) => `“${l.text}”`).join('\n')} — ${song.title}, ${song.artistName}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="share-dest-pill"
              >
                Telegram
              </a>
            </div>
              </>
            )}
          </div>

          {/* Right Live Preview Stage */}
          <div className="card-preview-stage-v2">
            {template === 'spotify' ? (
              <div
                className="lyric-card-canvas-v2 tpl-spotify"
                style={{
                  aspectRatio: aspect.replace(':', ' / '),
                  background: `linear-gradient(155deg, ${theme.grad[0]}, ${theme.grad[1]})`,
                  fontFamily: fontMeta.css,
                }}
              >
                <div
                  className={`spotify-feed-card-inner ${
                    chosenLines.length >= 6
                      ? 'density-compact'
                      : chosenLines.length >= 4
                        ? 'density-medium'
                        : 'density-bold'
                  }`}
                  style={{
                    backgroundColor: theme.id === 'paper' ? '#FFFFFF' : theme.accent,
                    color:
                      theme.id === 'paper' || isBrightHex(theme.accent) ? '#0C0C0E' : '#FAF8F5',
                  }}
                >
                  <div className="sfc-header">
                    {showCover &&
                      (song.coverImage ? (
                        <img src={song.coverImage} alt={song.title} className="sfc-cover" />
                      ) : (
                        <div className="sfc-cover sfc-cover-fallback" />
                      ))}
                    <div className="sfc-meta">
                      <strong>{song.title}</strong>
                      <span>{song.artistName}</span>
                    </div>
                  </div>

                  <div className="sfc-lyrics">
                    {chosenLines.length === 0 ? (
                      <p className="lcv2-empty">Selecione ao menos 1 verso ao lado</p>
                    ) : (
                      chosenLines.map((line) => (
                        <div key={line.id} className="sfc-line-wrap">
                          <p className="sfc-lyric-line">{line.text}</p>
                          {showTranslation && line.translation && (
                            <p className="sfc-lyric-trans">{line.translation}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="sfc-footer">
                    <div className="sfc-brand">
                      <MimixMark size={18} monochrome />
                      <span>MIMIX</span>
                    </div>
                    {showWaveform && (
                      <div className="sfc-audio-badge">
                        <div className="sfc-mini-wave" aria-hidden="true">
                          {[10, 16, 12, 18, 9, 15, 11, 14].map((h, i) => (
                            <span
                              key={i}
                              className={snippetPlaying ? 'is-animating' : ''}
                              style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }}
                            />
                          ))}
                        </div>
                        <span className="sfc-time-tag">
                          {formatDurationShort(snippetStart)}–{formatDurationShort(snippetEnd)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
            <div
              className={`lyric-card-canvas-v2 tpl-${template} ${
                theme.isLight || template === 'polaroid' ? 'is-light' : ''
              }`}
              style={{
                aspectRatio: aspect.replace(':', ' / '),
                background:
                  template === 'polaroid'
                    ? '#F7F4EC'
                    : `linear-gradient(145deg, ${theme.grad[0]}, ${theme.grad[1]})`,
                color: template === 'polaroid' ? '#18181B' : theme.fg,
                fontFamily: fontMeta.css,
              }}
            >
              {/* Blurred Cover Backdrop for Glass */}
              {template === 'glass' && showCover && song.coverImage && (
                <div
                  className="lcv2-blur-bg"
                  style={{ backgroundImage: `url(${song.coverImage})` }}
                />
              )}

              {/* Ambient Glow */}
              <div
                className="lcv2-glow"
                style={{
                  background: `radial-gradient(circle at 25% 20%, ${theme.accent}44, transparent 65%)`,
                }}
              />

              <div className={`lcv2-inner ${template === 'glass' ? 'glass-box' : ''}`}>
                {/* Header */}
                {template === 'editorial' ? (
                  <div className="lcv2-editorial-head">
                    <span style={{ color: theme.accent }}>MIMIX • EDITORIAL</span>
                    <span className="mono">
                      {song.year} • {song.bpm} BPM
                    </span>
                  </div>
                ) : (
                  <div className="lcv2-song-head">
                    {showCover && (
                      <div className={`lcv2-art-wrap ${template === 'vinyl' ? 'with-vinyl' : ''}`}>
                        {template === 'vinyl' && (
                          <div className="lcv2-vinyl-disc">
                            <Disc3 size={22} style={{ color: theme.accent }} />
                          </div>
                        )}
                        {song.coverImage ? (
                          <img src={song.coverImage} alt={song.title} className="lcv2-cover-img" />
                        ) : (
                          <div
                            className="lcv2-cover-img"
                            style={{ background: song.coverGradient }}
                          />
                        )}
                      </div>
                    )}
                    <div className="lcv2-song-meta">
                      <div className="lcv2-title-line">
                        <strong>{song.title}</strong>
                        <CheckCircle2 size={13} style={{ color: theme.accent, flexShrink: 0 }} />
                      </div>
                      <span>{song.artistName}</span>
                      <small style={{ color: theme.accent }}>
                        {song.album} • {song.year}
                      </small>
                    </div>
                  </div>
                )}

                {/* Decorative quote for editorial */}
                {template === 'editorial' && (
                  <div className="lcv2-big-quote" style={{ color: `${theme.accent}33` }}>
                    “
                  </div>
                )}

                {/* Lyrics */}
                <div className="lcv2-lyrics-body">
                  {chosenLines.length === 0 ? (
                    <p className="lcv2-empty">Selecione ao menos 1 verso ao lado</p>
                  ) : (
                    chosenLines.map((line) => (
                      <div
                        key={line.id}
                        className={`lcv2-line ${template === 'player' ? 'player-pill' : ''}`}
                      >
                        <p className="lcv2-main-text">“{line.text}”</p>
                        {showTranslation && line.translation && (
                          <p className="lcv2-trans-text">{line.translation}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="lcv2-footer">
                  {showWaveform &&
                    (template === 'player' ? (
                      <div className="lcv2-scrubber">
                        <div className="lcv2-track">
                          <div
                            className="lcv2-fill"
                            style={{ backgroundColor: theme.accent, width: '42%' }}
                          />
                        </div>
                        <div className="lcv2-times">
                          <span>{formatDurationShort(chosenLines[0]?.time || 48)}</span>
                          <span>{formatDurationShort(song.duration || 210)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="lcv2-waveform">
                        {waveHeights.map((h, idx) => (
                          <span
                            key={idx}
                            style={{
                              height: `${Math.round(h * 0.24)}px`,
                              backgroundColor:
                                idx < waveHeights.length * 0.45 ? theme.accent : `${theme.fg}38`,
                            }}
                          />
                        ))}
                      </div>
                    ))}

                  <div className="lcv2-brand-row">
                    <strong style={{ color: theme.accent }}>MIMIX</strong>
                    <span>
                      • Trecho {formatDurationShort(snippetStart)}–{formatDurationShort(snippetEnd)}{' '}
                      •{' '}
                      {template === 'editorial'
                        ? `${song.title} — ${song.artistName}`
                        : 'mimix.music'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
