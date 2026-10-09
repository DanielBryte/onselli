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
        alt="Onselli"
        className={`onselli-logo-mark ${className}`}
      />
    );
  }

  return (
    <div className={`onselli-lockup ${className}`}>
      <img src="/logo.png" alt="" aria-hidden="true" className="onselli-logo-mark" />
      <span className={`onselli-wordmark${isWhite ? ' onselli-wordmark--white' : ''}`}>
        <strong>Onselli</strong>
        {showTagline && <small>Run. Sell. Grow.</small>}
      </span>
    </div>
  );
}

