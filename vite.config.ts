import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';
import { Readable } from 'stream';

const require = createRequire(import.meta.url);
const { Ytdl, chooseFormat } = require('@distube/ytdl-core');

const ytdl = new Ytdl();
const streamCache = new Map<
  string,
  { url: string; mimeType: string; contentLength: number; duration: number; expires: number }
>();
const lyricsCache = new Map<string, { payload: unknown; expires: number }>();

async function fetchYouTubeTimedCaptions(artist: string, title: string) {
  const queries = [`${artist} ${title} lyrics`, `${artist} ${title} official`];
  for (const q of queries) {
    try {
      const ytRes = await fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
      );
      const html = await ytRes.text();
      const matches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]);
      const videoIds = Array.from(new Set(matches)).slice(0, 3);

      for (const vid of videoIds) {
        try {
          const info = await ytdl.getInfo(vid);
          const tracks =
            info?.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          if (!Array.isArray(tracks) || tracks.length === 0) continue;

          // Prefer manual (non-asr) track first, then any track
          const track = tracks.find((t: { kind?: string }) => t.kind !== 'asr') || tracks[0];
          if (!track?.baseUrl) continue;

          const capUrl = track.baseUrl.includes('fmt=')
            ? track.baseUrl
            : `${track.baseUrl}&fmt=json3`;
          const capRes = await fetch(capUrl);
          if (!capRes.ok) continue;
          const capData = (await capRes.json()) as {
            events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
          };
          const events = capData.events || [];
          const timedLines: Array<{ time: number; text: string }> = [];

          for (const ev of events) {
            if (typeof ev.tStartMs !== 'number' || !Array.isArray(ev.segs)) continue;
            const rawText = ev.segs
              .map((s) => s.utf8 || '')
              .join('')
              .replace(/\s+/g, ' ')
              .trim();
            if (!rawText || /^\[.*\]$/.test(rawText) || /^♪+$/.test(rawText)) continue;
            timedLines.push({
              time: Math.round((ev.tStartMs / 1000) * 10) / 10,
              text: rawText.replace(/^♪\s*|\s*♪$/g, '').trim(),
            });
          }

          if (timedLines.length >= 6) {
            return {
              source: 'youtube-captions' as const,
              timedLines,
              duration: Number(info.videoDetails?.lengthSeconds || 0),
              lang: track.languageCode || 'auto',
            };
          }
        } catch {
          // try next video candidate
        }
      }
    } catch {
      // try next query
    }
  }
  return null;
}

async function resolveAudioStream(query: string) {
  const cached = streamCache.get(query);
  if (cached && cached.expires > Date.now()) {
    return cached;
  }

  // Search YouTube prioritizing "Topic" / studio audio for 1:1 LRC lyric sync
  const ytRes = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
  );
  const html = await ytRes.text();
  const matches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]);
  const videoIds = Array.from(new Set(matches)).slice(0, 4);

  for (const vid of videoIds) {
    try {
      const info = await ytdl.getInfo(vid);
      const format =
        chooseFormat(info.formats, { filter: { hasAudio: true, hasVideo: false }, quality: 'highestaudio' }) ||
        chooseFormat(info.formats, { filter: { hasAudio: true }, quality: 'highestaudio' });
      if (format?.url) {
        const entry = {
          url: format.url,
          mimeType: format.mimeType?.split(';')[0] || 'audio/webm',
          contentLength: Number(format.contentLength || 0),
          duration: Number(info.videoDetails?.lengthSeconds || 0),
          expires: Date.now() + 25 * 60 * 1000,
        };
        streamCache.set(query, entry);
        return entry;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function versoApiPlugin(): Plugin {
  return {
    name: 'verso-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/stream', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const q = url.searchParams.get('q') || '';
          if (!q) {
            res.statusCode = 400;
            res.end('Missing query');
            return;
          }

          const streamInfo = await resolveAudioStream(q);
          if (!streamInfo) {
            res.statusCode = 404;
            res.end('Audio stream not found');
            return;
          }

          const rangeHeader = req.headers.range;
          const fetchHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          };
          if (rangeHeader) {
            fetchHeaders.Range = rangeHeader;
          }

          const upstream = await fetch(streamInfo.url, { headers: fetchHeaders });
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', upstream.headers.get('content-type') || streamInfo.mimeType);
          res.setHeader('Accept-Ranges', 'bytes');
          const cl = upstream.headers.get('content-length');
          if (cl) res.setHeader('Content-Length', cl);
          const cr = upstream.headers.get('content-range');
          if (cr) res.setHeader('Content-Range', cr);

          if (upstream.body) {
            Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
          } else {
            res.end();
          }
        } catch {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Stream error');
          }
        }
      });

      server.middlewares.use('/api/yt', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const q = url.searchParams.get('q') || '';
          if (!q) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing query' }));
            return;
          }
          const ytRes = await fetch(
            `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
          );
          const html = await ytRes.text();
          const matches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(
            (m) => m[1]
          );
          const videoIds = Array.from(new Set(matches)).slice(0, 6);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ videoId: videoIds[0] || null, videoIds }));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ videoId: null, videoIds: [] }));
        }
      });

      server.middlewares.use('/api/lyrics', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const artist = (url.searchParams.get('artist') || '').trim();
          const title = (url.searchParams.get('title') || '').trim();
          if (!artist || !title) {
            res.statusCode = 400;
            res.end(JSON.stringify({ source: 'none' }));
            return;
          }

          const cacheKey = `${artist.toLowerCase()}::${title.toLowerCase()}`;
          const cached = lyricsCache.get(cacheKey);
          if (cached && cached.expires > Date.now()) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(cached.payload));
            return;
          }

          const cleanTitle = title.replace(/\(.*?\)|\[.*?\]|-.*$/g, '').trim() || title;
          const cleanArtist = artist.split('&')[0].split(',')[0].trim() || artist;

          // Stage 1: LRCLIB exact + search
          let payload: Record<string, unknown> | null = null;
          try {
            let lrRes = await fetch(
              `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`
            );
            let lrData: { syncedLyrics?: string; plainLyrics?: string; duration?: number } | null =
              lrRes.ok ? await lrRes.json() : null;

            if (!lrData || (!lrData.syncedLyrics && !lrData.plainLyrics)) {
              lrRes = await fetch(
                `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`
              );
              if (lrRes.ok) {
                const list = (await lrRes.json()) as Array<{
                  syncedLyrics?: string;
                  plainLyrics?: string;
                  duration?: number;
                }>;
                lrData = list.find((t) => t.syncedLyrics) || list.find((t) => t.plainLyrics) || null;
              }
            }

            if (lrData?.syncedLyrics) {
              payload = {
                source: 'synced',
                syncedLyrics: lrData.syncedLyrics,
                duration: lrData.duration,
              };
            } else if (lrData?.plainLyrics) {
              payload = {
                source: 'plain',
                plainLyrics: lrData.plainLyrics,
                duration: lrData.duration,
              };
            }
          } catch {
            // proceed to Stage 2
          }

          // Stage 2: YouTube Timed Captions / Auto-Subtitles (any language)
          if (!payload) {
            const ytCaps = await fetchYouTubeTimedCaptions(cleanArtist, cleanTitle);
            if (ytCaps) {
              payload = ytCaps;
            }
          }

          // Stage 3: lyrics.ovh plain lyrics fallback
          if (!payload) {
            try {
              const ovhRes = await fetch(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`
              );
              if (ovhRes.ok) {
                const ovhData = (await ovhRes.json()) as { lyrics?: string };
                if (ovhData.lyrics && ovhData.lyrics.trim().length > 20) {
                  payload = {
                    source: 'plain',
                    plainLyrics: ovhData.lyrics.trim(),
                  };
                }
              }
            } catch {
              // ignore
            }
          }

          const finalPayload = payload || { source: 'none' };
          lyricsCache.set(cacheKey, { payload: finalPayload, expires: Date.now() + 30 * 60 * 1000 });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(finalPayload));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ source: 'none' }));
        }
      });

      server.middlewares.use('/api/translate', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const { lines, targetLang } = JSON.parse(body || '{}') as {
              lines: string[];
              targetLang: string;
            };
            if (!Array.isArray(lines) || lines.length === 0) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ translations: [] }));
              return;
            }
            const tl = targetLang || 'pt-BR';
            const allTranslations: string[] = [];
            let detectedLang = 'auto';

            const translateSingle = async (text: string): Promise<string> => {
              const r = await fetch(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
                  tl
                )}&dt=t&q=${encodeURIComponent(text)}`
              );
              if (!r.ok) return '';
              const d = (await r.json()) as [Array<[string, string]>, unknown, string?];
              if (d?.[2] && detectedLang === 'auto') detectedLang = d[2];
              return (d?.[0] || []).map((seg) => seg[0]).join('').trim();
            };

            const chunkSize = 15;
            for (let i = 0; i < lines.length; i += chunkSize) {
              const chunk = lines.slice(i, i + chunkSize);
              const joined = chunk.join('\n');
              const trRes = await fetch(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
                  tl
                )}&dt=t&q=${encodeURIComponent(joined)}`
              );

              let chunkOk = false;
              if (trRes.ok) {
                const data = (await trRes.json()) as [Array<[string, string]>, unknown, string?];
                if (data?.[2] && detectedLang === 'auto') detectedLang = data[2];
                const fullText = (data?.[0] || []).map((seg) => seg[0]).join('');
                const parts = fullText.split('\n').map((s) => s.trim());
                if (parts.length === chunk.length && parts.every((p) => p.length > 0)) {
                  allTranslations.push(...parts);
                  chunkOk = true;
                }
              }

              // Strict 1:1 parallel fallback if newline count differed
              if (!chunkOk) {
                const individual = await Promise.all(chunk.map((l) => translateSingle(l)));
                allTranslations.push(...individual);
              }
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ translations: allTranslations, detectedLang }));
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ translations: [] }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versoApiPlugin()],
});
