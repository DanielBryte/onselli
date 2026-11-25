interface LogoProps {
  variant?: 'full' | 'icon' | 'white';
  className?: string;
  showTagline?: boolean;
}

export default function Logo({ variant = 'full', className = '', showTagline = false }: LogoProps) {
  const isWhite = variant === 'white';
  const hasCustomGap = /\bgap-\S+/.test(className);

  if (variant === 'icon') {
    return (
      <img
        src="/logo.png"
        alt="Onselli"
        className={`onselli-logo-mark block size-[38px] shrink-0 rounded-[10px] object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex items-center ${hasCustomGap ? '' : 'gap-[11px]'} whitespace-nowrap ${className}`}>
      <img src="/logo.png" alt="" aria-hidden="true" className="onselli-logo-mark block size-[38px] shrink-0 rounded-[10px] object-cover" />
      <span className={`flex flex-col justify-center leading-none ${isWhite ? 'text-white' : 'text-ink'}`}>
        <strong className="text-2xl font-extrabold tracking-[-.04em]">Onselli</strong>
        {showTagline && <small className={`mt-[5px] text-[10px] font-[550] tracking-[.02em] ${isWhite ? 'text-white/[.74]' : 'text-muted'}`}>Run. Sell. Grow.</small>}
      </span>
    </div>
  );
}

