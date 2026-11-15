import React, { useState } from 'react';

interface CoverArtProps {
  src?: string;
  gradient: string;
  alt: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const CoverArt: React.FC<CoverArtProps> = ({
  src,
  gradient,
  alt,
  className = '',
  children,
  onClick,
  title,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`cover-art-frame ${className}`}
      style={{ background: gradient }}
      onClick={onClick}
      title={title}
    >
      {src && !imgFailed && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="cover-art-img"
          onError={() => setImgFailed(true)}
        />
      )}
      {children && <div className="cover-art-overlay">{children}</div>}
    </div>
  );
};
