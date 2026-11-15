import { Artist, Playlist, Song } from '../types/music';
import realCatalog from './realCatalog.json';

export const ARTISTS: Artist[] = realCatalog.artists as Artist[];
export const SONGS: Song[] = realCatalog.songs as Song[];

const topBr = SONGS.filter((s) => s.country === 'Brasil').slice(0, 4).map((s) => s.id);
const topGlobal = SONGS.filter((s) => s.language !== 'pt').slice(0, 4).map((s) => s.id);
const topKpopJpop = SONGS.filter((s) => s.country === 'Coreia do Sul' || s.country === 'Japão')
  .slice(0, 4)
  .map((s) => s.id);
const topLatin = SONGS.filter((s) => s.language === 'es' || s.country === 'Nigéria')
  .slice(0, 4)
  .map((s) => s.id);

export const PLAYLISTS: Playlist[] = [
  {
    id: 'top-brasil-2026',
    title: 'Top Brasil Agora',
    subtitle: 'As músicas reais mais tocadas nas paradas brasileiras hoje',
    curator: 'Parada Brasil',
    coverImage: SONGS.find((s) => s.country === 'Brasil')?.coverImage || '',
    coverGradient: 'linear-gradient(135deg, #FF5722 0%, #F59E0B 100%)',
    songIds: topBr,
  },
  {
    id: 'top-global-2026',
    title: 'Global Hits & Traduções',
    subtitle: 'Sucessos dos EUA e Reino Unido com letras sincronizadas e tradução',
    curator: 'MIMIX Global',
    coverImage: SONGS.find((s) => s.country === 'Estados Unidos')?.coverImage || '',
    coverGradient: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
    songIds: topGlobal,
  },
  {
    id: 'asia-beats',
    title: 'Seul & Tóquio (K-Pop / J-Pop)',
    subtitle: 'O melhor das paradas da Coreia do Sul e do Japão',
    curator: 'MIMIX Ásia',
    coverImage: SONGS.find((s) => s.country === 'Coreia do Sul')?.coverImage || '',
    coverGradient: 'linear-gradient(135deg, #EC4899 0%, #6D28D9 100%)',
    songIds: topKpopJpop,
  },
  {
    id: 'latam-afro',
    title: 'Latino & Afrobeats',
    subtitle: 'Espanha, Colômbia e Nigéria em alta no mundo todo',
    curator: 'Curadoria Mundial',
    coverImage: SONGS.find((s) => s.country === 'Nigéria')?.coverImage || '',
    coverGradient: 'linear-gradient(135deg, #10B981 0%, #F59E0B 100%)',
    songIds: topLatin,
  },
];
