import React from 'react';

interface LogoProps {
  variant?: 'full' | 'icon' | 'white';
  className?: string;
  showTagline?: boolean;
}

export default function Logo({ variant = 'full', className = '', showTagline = false }: LogoProps) {
  const isWhite = variant === 'white';

  if (variant === 'icon') {
    return (
      <img
        src="/logo.png"
        alt="Onselli Logo"
        className={`h-7 w-auto object-contain ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="Onselli Logo"
          className={`h-9 w-auto object-contain ${isWhite ? 'brightness-0 invert' : ''}`}
        />
      </div>
      {showTagline && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: isWhite ? 'rgba(255,255,255,0.75)' : '#49665a',
            letterSpacing: '0.04em',
            marginTop: '3px'
          }}
        >
          Run. Sell. Grow.
        </span>
      )}
    </div>
  );
}

