const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

export function normalizeRoot(root: string): string {
  return FLAT_TO_SHARP[root] || root;
}

export function transposeNote(note: string, semitones: number): string {
  const normalized = normalizeRoot(note);
  const idx = SHARP_SCALE.indexOf(normalized);
  if (idx === -1) return note;
  const nextIdx = ((idx + semitones) % 12 + 12) % 12;
  return SHARP_SCALE[nextIdx];
}

/**
 * Transposes a full chord symbol like "F#m7", "Bb/D", "Gmaj7", "Dsus4".
 */
export function transposeChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord;
  return chord.replace(/^([A-G][#b]?)(.*)$/, (_, root: string, rest: string) => {
    const slashIdx = rest.indexOf('/');
    if (slashIdx !== -1) {
      const quality = rest.slice(0, slashIdx);
      const bass = rest.slice(slashIdx + 1);
      const bassMatch = bass.match(/^([A-G][#b]?)(.*)$/);
      if (bassMatch) {
        return `${transposeNote(root, semitones)}${quality}/${transposeNote(bassMatch[1], semitones)}${bassMatch[2]}`;
      }
    }
    return `${transposeNote(root, semitones)}${rest}`;
  });
}

export interface GuitarVoicing {
  /** 6 strings from low E (6th) to high e (1st). -1 = muted, 0 = open, >0 = fret */
  frets: [number, number, number, number, number, number];
  baseFret?: number;
}

const BASE_GUITAR_VOICINGS: Record<string, GuitarVoicing> = {
  C: { frets: [-1, 3, 2, 0, 1, 0] },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0] },
  Cm: { frets: [-1, 3, 5, 5, 4, 3], baseFret: 3 },
  'C#m': { frets: [-1, 4, 6, 6, 5, 4], baseFret: 4 },
  D: { frets: [-1, -1, 0, 2, 3, 2] },
  Dm: { frets: [-1, -1, 0, 2, 3, 1] },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1] },
  D7: { frets: [-1, -1, 0, 2, 1, 2] },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3] },
  E: { frets: [0, 2, 2, 1, 0, 0] },
  Em: { frets: [0, 2, 2, 0, 0, 0] },
  Em7: { frets: [0, 2, 0, 0, 0, 0] },
  E7: { frets: [0, 2, 0, 1, 0, 0] },
  F: { frets: [1, 3, 3, 2, 1, 1] },
  Fmaj7: { frets: [-1, -1, 3, 2, 1, 0] },
  Fm: { frets: [1, 3, 3, 1, 1, 1] },
  'F#m': { frets: [2, 4, 4, 2, 2, 2] },
  'F#m7': { frets: [2, 4, 2, 2, 2, 2] },
  G: { frets: [3, 2, 0, 0, 0, 3] },
  G7: { frets: [3, 2, 0, 0, 0, 1] },
  Gm: { frets: [3, 5, 5, 3, 3, 3], baseFret: 3 },
  A: { frets: [-1, 0, 2, 2, 2, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0] },
  A7: { frets: [-1, 0, 2, 0, 2, 0] },
  Asus4: { frets: [-1, 0, 2, 2, 3, 0] },
  B: { frets: [-1, 2, 4, 4, 4, 2] },
  Bm: { frets: [-1, 2, 4, 4, 3, 2] },
  Bm7: { frets: [-1, 2, 4, 2, 3, 2] },
  B7: { frets: [-1, 2, 1, 2, 0, 2] },
  'A#': { frets: [-1, 1, 3, 3, 3, 1] },
  'A#m': { frets: [-1, 1, 3, 3, 2, 1] },
  'G#m': { frets: [4, 6, 6, 4, 4, 4], baseFret: 4 },
  'G#': { frets: [4, 6, 6, 5, 4, 4], baseFret: 4 },
  'D#m': { frets: [-1, -1, 1, 3, 4, 2] },
};

export function getGuitarVoicing(chord: string): GuitarVoicing {
  const clean = chord.split('/')[0];
  if (BASE_GUITAR_VOICINGS[clean]) {
    return BASE_GUITAR_VOICINGS[clean];
  }
  const match = clean.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return { frets: [-1, 3, 2, 0, 1, 0] };
  const root = normalizeRoot(match[1]);
  const quality = match[2];
  const isMinor = quality.startsWith('m') && !quality.startsWith('maj');
  const fallbackKey = `${root}${isMinor ? 'm' : ''}`;
  if (BASE_GUITAR_VOICINGS[fallbackKey]) {
    return BASE_GUITAR_VOICINGS[fallbackKey];
  }
  // Movable barre shape fallback
  const rootIdx = SHARP_SCALE.indexOf(root);
  const fret = ((rootIdx - 4 + 12) % 12) || 1;
  return isMinor
    ? { frets: [fret, fret + 2, fret + 2, fret, fret, fret], baseFret: fret }
    : { frets: [fret, fret + 2, fret + 2, fret + 1, fret, fret], baseFret: fret };
}

/** Returns MIDI-like semitone offsets (0-11) for piano keyboard visualization & Web Audio synthesis */
export function getChordNotes(chord: string): number[] {
  const clean = chord.split('/')[0];
  const match = clean.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return [0, 4, 7];
  const root = normalizeRoot(match[1]);
  const quality = match[2];
  const rootIdx = SHARP_SCALE.indexOf(root);
  if (rootIdx === -1) return [0, 4, 7];

  const isMinor = quality.startsWith('m') && !quality.startsWith('maj');
  const isDim = quality.includes('dim');
  const isSus4 = quality.includes('sus4');
  const isMaj7 = quality.includes('maj7');
  const is7 = quality.includes('7') && !isMaj7;

  const intervals = [0];
  if (isSus4) intervals.push(5);
  else if (isMinor || isDim) intervals.push(3);
  else intervals.push(4);

  if (isDim) intervals.push(6);
  else intervals.push(7);

  if (isMaj7) intervals.push(11);
  else if (is7) intervals.push(10);

  return intervals.map((i) => rootIdx + i);
}

export function semitoneToFreq(semitoneFromC4: number): number {
  // C4 = MIDI 60, A4 = MIDI 69 (440 Hz)
  const midi = 60 + semitoneFromC4;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
