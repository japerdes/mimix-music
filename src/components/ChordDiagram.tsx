import React from 'react';
import { Volume2 } from 'lucide-react';
import { getChordNotes, getGuitarVoicing } from '../utils/chords';
import { audioEngine } from '../utils/audioEngine';

interface ChordDiagramProps {
  chord: string;
  compact?: boolean;
}

export const ChordDiagram: React.FC<ChordDiagramProps> = ({ chord, compact = false }) => {
  const voicing = getGuitarVoicing(chord);
  const notes = getChordNotes(chord).map((n) => n % 12);

  // Determine fret window for guitar diagram
  const positiveFrets = voicing.frets.filter((f) => f > 0);
  const minFret = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const maxFret = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 4;
  const startFret = voicing.baseFret ?? (maxFret > 4 ? minFret : 1);

  const width = compact ? 104 : 132;
  const height = compact ? 112 : 136;
  const padX = 18;
  const padTop = 22;
  const gridW = width - padX * 2;
  const gridH = height - padTop - 16;
  const stringStep = gridW / 5;
  const fretStep = gridH / 4;

  // Piano keys (1 octave: C=0 .. B=11)
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11];
  const blackKeys = [
    { note: 1, pos: 0.7 },
    { note: 3, pos: 1.7 },
    { note: 6, pos: 3.7 },
    { note: 8, pos: 4.7 },
    { note: 10, pos: 5.7 },
  ];

  return (
    <div className="chord-card">
      <div className="chord-card-header">
        <span className="chord-card-name">{chord}</span>
        <button
          type="button"
          className="chord-audition-btn"
          onClick={() => audioEngine.playChord(chord)}
          title={`Ouvir acorde ${chord}`}
        >
          <Volume2 size={14} />
          <span>Ouvir</span>
        </button>
      </div>

      <div className="chord-diagrams-row">
        {/* Guitar SVG */}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="guitar-svg">
          {/* Nut or start fret indicator */}
          {startFret === 1 ? (
            <line
              x1={padX}
              y1={padTop}
              x2={padX + gridW}
              y2={padTop}
              stroke="#F5F2EB"
              strokeWidth={3}
              strokeLinecap="round"
            />
          ) : (
            <text x={4} y={padTop + fretStep * 0.65} fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono">
              {startFret}ª
            </text>
          )}

          {/* Frets */}
          {[0, 1, 2, 3, 4].map((f) => (
            <line
              key={`f-${f}`}
              x1={padX}
              y1={padTop + f * fretStep}
              x2={padX + gridW}
              y2={padTop + f * fretStep}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
            />
          ))}

          {/* Strings */}
          {[0, 1, 2, 3, 4, 5].map((s) => (
            <line
              key={`s-${s}`}
              x1={padX + s * stringStep}
              y1={padTop}
              x2={padX + s * stringStep}
              y2={padTop + gridH}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={1.2}
            />
          ))}

          {/* Finger dots, open circles, muted X */}
          {voicing.frets.map((fret, sIdx) => {
            const x = padX + sIdx * stringStep;
            if (fret === -1) {
              return (
                <text
                  key={`m-${sIdx}`}
                  x={x}
                  y={padTop - 7}
                  textAnchor="middle"
                  fill="#71717A"
                  fontSize="10"
                  fontWeight="700"
                >
                  ×
                </text>
              );
            }
            if (fret === 0) {
              return (
                <circle
                  key={`o-${sIdx}`}
                  cx={x}
                  cy={padTop - 9}
                  r={3.5}
                  fill="none"
                  stroke="#A1A1AA"
                  strokeWidth={1.4}
                />
              );
            }
            const relFret = fret - startFret + 1;
            if (relFret < 1 || relFret > 4) return null;
            const cy = padTop + (relFret - 0.5) * fretStep;
            return (
              <circle
                key={`d-${sIdx}`}
                cx={x}
                cy={cy}
                r={compact ? 4.8 : 5.5}
                fill="#FF6B3D"
                stroke="#18181B"
                strokeWidth={1.2}
              />
            );
          })}
        </svg>

        {/* Mini Piano SVG */}
        {!compact && (
          <svg width={112} height={54} viewBox="0 0 112 54" className="piano-svg">
            {whiteKeys.map((note, idx) => {
              const active = notes.includes(note);
              return (
                <rect
                  key={`wk-${note}`}
                  x={idx * 16 + 1}
                  y={1}
                  width={14}
                  height={50}
                  rx={2}
                  fill={active ? '#FF6B3D' : '#F4F4F5'}
                  stroke="#18181B"
                  strokeWidth={1}
                />
              );
            })}
            {blackKeys.map(({ note, pos }) => {
              const active = notes.includes(note);
              return (
                <rect
                  key={`bk-${note}`}
                  x={pos * 16 + 1}
                  y={1}
                  width={9.5}
                  height={31}
                  rx={1.5}
                  fill={active ? '#FF8F6B' : '#18181B'}
                  stroke="#09090B"
                  strokeWidth={1}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};
