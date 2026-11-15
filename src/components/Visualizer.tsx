import React from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  accentColor?: string;
  bars?: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  isPlaying,
  accentColor = '#FF6B3D',
  bars = 16,
}) => {
  return (
    <div className={`visualizer ${isPlaying ? 'playing' : ''}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, idx) => (
        <span
          key={idx}
          className="viz-bar"
          style={{
            backgroundColor: accentColor,
            animationDelay: `${(idx % 5) * 0.12}s`,
            height: isPlaying ? undefined : `${22 + ((idx * 17) % 45)}%`,
          }}
        />
      ))}
    </div>
  );
};
