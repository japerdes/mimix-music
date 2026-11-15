export interface ArtistBioData {
  summary: string;
  wikipediaUrl?: string;
  thumbnail?: string;
  albums: {
    id: number;
    title: string;
    year: number;
    cover: string;
    trackCount?: number;
  }[];
}

export async function fetchArtistDetails(artistName: string): Promise<ArtistBioData> {
  const cleanName = artistName.split('&')[0].split(',')[0].trim();
  const cacheKey = `verso_artist_v1_${cleanName.toLowerCase()}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // ignore storage errors
  }

  let summary = '';
  let wikipediaUrl: string | undefined;
  let thumbnail: string | undefined;

  // 1. Fetch Wikipedia summary (try Portuguese first, then English)
  for (const lang of ['pt', 'en']) {
    if (summary) break;
    try {
      const searchRes = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanName)}&limit=1&namespace=0&format=json&origin=*`
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const pageTitle = searchData?.[1]?.[0];
        if (pageTitle) {
          const sumRes = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
          );
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            if (sumData.extract) {
              summary = sumData.extract;
              wikipediaUrl = sumData.content_urls?.desktop?.page;
              thumbnail = sumData.thumbnail?.source;
            }
          }
        }
      }
    } catch {
      // ignore network error
    }
  }

  // 2. Fetch real albums/discography from iTunes
  let albums: ArtistBioData['albums'] = [];
  try {
    const albRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(cleanName)}&entity=album&limit=6`
    );
    if (albRes.ok) {
      const albData = await albRes.json();
      const raw = Array.isArray(albData.results) ? albData.results : [];
      albums = raw.map((a: Record<string, unknown>) => ({
        id: Number(a.collectionId),
        title: String(a.collectionName || 'Álbum'),
        year: a.releaseDate ? new Date(String(a.releaseDate)).getFullYear() : 2026,
        cover: String(a.artworkUrl100 || '').replace('100x100bb', '300x300bb'),
        trackCount: Number(a.trackCount || 0),
      }));
    }
  } catch {
    // ignore
  }

  const result: ArtistBioData = {
    summary:
      summary ||
      `${artistName} é um artista em destaque no catálogo global do MIMIX. Explore suas faixas, letras sincronizadas e discografia abaixo.`,
    wikipediaUrl,
    thumbnail,
    albums,
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {}

  return result;
}
