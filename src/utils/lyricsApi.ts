import { LyricLine } from '../types/music';

interface LrcLibTrack {
  id: number;
  trackName: string;
  artistName: string;
  plainLyrics?: string;
  syncedLyrics?: string;
  duration?: number;
}

export const TARGET_LANGUAGES = [
  { code: 'pt-BR', label: '🇧🇷 Português' },
  { code: 'en', label: '🇺🇸 Inglês' },
  { code: 'es', label: '🇪🇸 Espanhol' },
  { code: 'fr', label: '🇫🇷 Francês' },
  { code: 'it', label: '🇮🇹 Italiano' },
  { code: 'de', label: '🇩🇪 Alemão' },
  { code: 'ja', label: '🇯🇵 Japonês' },
  { code: 'ko', label: '🇰🇷 Coreano' },
  { code: 'ru', label: '🇷🇺 Russo' },
  { code: 'ar', label: '🇸🇦 Árabe' },
];

const DEFAULT_CHORDS = ['Am', 'F', 'C', 'G'];

function parseLrc(lrcText: string, chords: string[] = DEFAULT_CHORDS): LyricLine[] {
  const lines: LyricLine[] = [];
  const rawLines = lrcText.split('\n');
  let idx = 0;

  for (const raw of rawLines) {
    const match = raw.match(/^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)$/);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
    const time = mins * 60 + secs + ms / 1000;
    const text = match[4].trim();
    if (!text) continue;

    const chord1 = chords[idx % chords.length];
    const chord2 = chords[(idx + 1) % chords.length];
    lines.push({
      id: `lrc-${idx}`,
      time,
      text,
      chords:
        text.length > 16
          ? [
              { pos: 0, chord: chord1 },
              { pos: Math.floor(text.length * 0.55), chord: chord2 },
            ]
          : [{ pos: 0, chord: chord1 }],
    });
    idx++;
  }
  return lines;
}

function parsePlain(plainText: string, duration = 180, chords: string[] = DEFAULT_CHORDS): LyricLine[] {
  const rawLines = plainText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const step = Math.max(2.5, duration / Math.max(1, rawLines.length));

  return rawLines.map((text, idx) => {
    const isSection = /^\[.*\]$/.test(text);
    const chord1 = chords[idx % chords.length];
    const chord2 = chords[(idx + 1) % chords.length];
    return {
      id: `plain-${idx}`,
      time: Math.round(idx * step * 10) / 10,
      text,
      isSection,
      chords: isSection
        ? undefined
        : text.length > 16
        ? [
            { pos: 0, chord: chord1 },
            { pos: Math.floor(text.length * 0.55), chord: chord2 },
          ]
        : [{ pos: 0, chord: chord1 }],
    };
  });
}

export async function fetchRealLyrics(
  songId: string,
  title: string,
  artistName: string,
  chordProgression: string[]
): Promise<{ lines: LyricLine[]; duration?: number; source: 'synced' | 'plain' | 'none' }> {
  const cacheKey = `verso_lyrics_v2_${songId}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.lines?.length > 0) return parsed;
    }
  } catch {
    // ignore storage read errors
  }

  try {
    const res = await fetch(
      `/api/lyrics?artist=${encodeURIComponent(artistName)}&title=${encodeURIComponent(title)}`
    );
    if (res.ok) {
      const data = (await res.json()) as {
        source: 'synced' | 'plain' | 'youtube-captions' | 'none';
        syncedLyrics?: string;
        plainLyrics?: string;
        timedLines?: Array<{ time: number; text: string }>;
        duration?: number;
      };

      if (data.source === 'synced' && data.syncedLyrics) {
        const lines = parseLrc(data.syncedLyrics, chordProgression);
        const result = { lines, duration: data.duration, source: 'synced' as const };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {}
        return result;
      }

      if (data.source === 'youtube-captions' && Array.isArray(data.timedLines) && data.timedLines.length > 0) {
        const lines: LyricLine[] = data.timedLines.map((item, idx) => {
          const chord1 = chordProgression[idx % chordProgression.length] || 'Am';
          const chord2 = chordProgression[(idx + 1) % chordProgression.length] || 'G';
          return {
            id: `ytcap-${idx}`,
            time: item.time,
            text: item.text,
            chords:
              item.text.length > 16
                ? [
                    { pos: 0, chord: chord1 },
                    { pos: Math.floor(item.text.length * 0.55), chord: chord2 },
                  ]
                : [{ pos: 0, chord: chord1 }],
          };
        });
        const result = { lines, duration: data.duration, source: 'synced' as const };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {}
        return result;
      }

      if (data.source === 'plain' && data.plainLyrics) {
        const lines = parsePlain(data.plainLyrics, data.duration || 180, chordProgression);
        const result = { lines, duration: data.duration, source: 'plain' as const };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {}
        return result;
      }
    }
  } catch {
    // network error on local middleware; fall back to direct LRCLIB below
  }

  // Direct client-side fallback to LRCLIB API
  try {
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const lrcRes = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${artistName}`)}`
    );
    if (lrcRes.ok) {
      const tracks = (await lrcRes.json()) as LrcLibTrack[];
      const match =
        tracks.find((t) => t.syncedLyrics) || tracks.find((t) => t.plainLyrics) || tracks[0];
      if (match?.syncedLyrics) {
        const lines = parseLrc(match.syncedLyrics, chordProgression);
        if (lines.length > 0) {
          const result = { lines, duration: match.duration, source: 'synced' as const };
          try {
            localStorage.setItem(cacheKey, JSON.stringify(result));
          } catch {}
          return result;
        }
      }
      if (match?.plainLyrics) {
        const lines = parsePlain(match.plainLyrics, match.duration || 180, chordProgression);
        if (lines.length > 0) {
          const result = { lines, duration: match.duration, source: 'plain' as const };
          try {
            localStorage.setItem(cacheKey, JSON.stringify(result));
          } catch {}
          return result;
        }
      }
    }
  } catch {
    // ignore fallback errors
  }

  // Graceful musical fallback lines so SongView, Karaoke & LyricCardModal never stay empty
  const chords = chordProgression?.length ? chordProgression : DEFAULT_CHORDS;
  const fallbackTexts = [
    `${title} — ${artistName}`,
    `Sentindo cada acorde e melodia no ar`,
    `O som que ecoa e não deixa esquecer`,
    `Em cada batida, a história ganha voz`,
    `Vivendo o momento dentro da canção`,
    `Quando a música toca, o tempo para`,
  ];
  const fallbackLines: LyricLine[] = fallbackTexts.map((text, idx) => ({
    id: `fb-${idx}`,
    time: idx * 6,
    text,
    chords: [{ pos: 0, chord: chords[idx % chords.length] }],
  }));

  return { lines: fallbackLines, source: 'plain' };
}

export async function translateAllLines(
  songId: string,
  lines: LyricLine[],
  _sourceLang: string,
  targetLang = 'pt-BR',
  onProgress?: (done: number, total: number, partialLines?: LyricLine[], detectedLang?: string) => void
): Promise<{ lines: LyricLine[]; detectedLang?: string }> {
  const cacheKey = `verso_trans_v6_${songId}_${targetLang}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { map: Record<string, string>; detectedLang?: string };
      if (parsed?.map && Object.keys(parsed.map).length > 0) {
        const merged = lines.map((l) =>
          parsed.map[l.id] ? { ...l, translation: parsed.map[l.id] } : l
        );
        return { lines: merged, detectedLang: parsed.detectedLang };
      }
    }
  } catch {}

  const nonSection = lines.filter((l) => !l.isSection && l.text.trim().length > 0);
  if (nonSection.length === 0) return { lines };

  const translatedMap: Record<string, string> = {};
  let detectedLang = 'auto';
  const batchSize = 15;

  for (let i = 0; i < nonSection.length; i += batchSize) {
    const batch = nonSection.slice(i, i + batchSize);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: batch.map((l) => l.text),
          targetLang,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.detectedLang && data.detectedLang !== 'auto') {
          detectedLang = data.detectedLang;
        }
        const translations: string[] = Array.isArray(data.translations) ? data.translations : [];
        batch.forEach((line, idx) => {
          if (translations[idx]) translatedMap[line.id] = translations[idx];
        });
      }
    } catch {
      // continue next batch
    }

    if (onProgress) {
      const partial = lines.map((l) =>
        translatedMap[l.id] ? { ...l, translation: translatedMap[l.id] } : l
      );
      onProgress(Math.min(i + batch.length, nonSection.length), nonSection.length, partial, detectedLang);
    }
  }

  try {
    if (Object.keys(translatedMap).length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify({ map: translatedMap, detectedLang }));
    }
  } catch {}

  return {
    lines: lines.map((l) => (translatedMap[l.id] ? { ...l, translation: translatedMap[l.id] } : l)),
    detectedLang,
  };
}

export async function fetchYouTubeVideoIds(
  songId: string,
  title: string,
  artistName: string
): Promise<string[]> {
  const cacheKey = `verso_yt_v2_${songId}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
  const cleanArtist = artistName.split('&')[0].split(',')[0].trim();
  try {
    const res = await fetch(`/api/yt?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle} official audio`)}`);
    if (res.ok) {
      const data = await res.json();
      const ids: string[] = Array.isArray(data.videoIds)
        ? data.videoIds
        : data.videoId
        ? [data.videoId]
        : [];
      if (ids.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(ids));
        } catch {}
        return ids;
      }
    }
  } catch {}
  return [];
}
