export type Genre =
  | 'MPB'
  | 'Sertanejo'
  | 'Rock'
  | 'Pop'
  | 'Rap & Trap'
  | 'Funk'
  | 'Indie'
  | 'Gospel'
  | 'Bossa Nova'
  | 'Pagode'
  | 'Eletrônica'
  | 'K-Pop'
  | 'J-Pop'
  | 'Afrobeats'
  | 'Reggaeton'
  | 'Chanson';

export interface ChordMark {
  /** Character index in the lyric line where the chord sits */
  pos: number;
  chord: string;
}

export interface LineAnnotation {
  author: string;
  title: string;
  body: string;
  category: 'Metáfora' | 'História' | 'Referência' | 'Produção' | 'Comunidade';
  votes?: number;
}

export interface VocabItem {
  word: string;
  meaning: string;
  phonetic?: string;
  note?: string;
}

export interface LyricLine {
  id: string;
  /** Timestamp in seconds for synced lyrics & karaoke */
  time: number;
  text: string;
  translation?: string;
  chords?: ChordMark[];
  annotation?: LineAnnotation;
  vocab?: VocabItem[];
  isSection?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  album: string;
  year: number;
  genre: Genre;
  country: string;
  flag: string;
  language: string;
  languageLabel: string;
  bpm: number;
  musicalKey: string;
  duration: number; // seconds
  views: string;
  viewsNum: number;
  trendDelta: number;
  rank: number;
  coverImage: string;
  coverGradient: string;
  accentColor: string;
  tags: string[];
  chordProgression: string[];
  story: string;
  previewUrl?: string;
  credits: {
    writers: string[];
    producers: string[];
    label: string;
  };
  lines: LyricLine[];
}

export interface Artist {
  id: string;
  name: string;
  genre: Genre;
  country: string;
  flag: string;
  monthlyListeners: string;
  verified: boolean;
  bio: string;
  coverImage: string;
  coverGradient: string;
  accentColor: string;
  topTags: string[];
}

export interface Playlist {
  id: string;
  title: string;
  subtitle: string;
  curator: string;
  coverImage: string;
  coverGradient: string;
  songIds: string[];
}
