'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { Check, Sparkles } from 'lucide-react';

const confettiColors = ['#087653', '#72c59e', '#f3bd5a', '#e77d6e', '#8ca7e8', '#b78ad7'];
const confettiPieces = Array.from({ length: 36 }, (_, index) => index);

export default function ProductPublishCelebration({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(onComplete, 2400);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [onComplete]);

  function finishNow() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    onComplete();
  }

  return (
    <div className="product-publish-celebration">
      <div className="product-publish-celebration__confetti" aria-hidden="true">
        {confettiPieces.map((index) => (
          <i
            key={index}
            style={
              {
                left: `${(index * 43) % 100}%`,
                backgroundColor: confettiColors[index % confettiColors.length],
                animationDelay: `${(index % 9) * 65}ms`,
                '--confetti-drift': `${((index * 53) % 260) - 130}px`,
                '--confetti-rotation': `${index * 47}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <section className="product-publish-celebration__card" aria-label="Product published">
        <span className="product-publish-celebration__icon" aria-hidden="true">
          <Check size={22} strokeWidth={2.5} />
        </span>
        <Sparkles className="product-publish-celebration__sparkle" size={18} aria-hidden="true" />
        <div className="product-publish-celebration__message" role="status" aria-live="polite">
          <h2>Product published</h2>
          <p>Your product is live and ready for buyers.</p>
        </div>
        <button type="button" onClick={finishNow}>
          Go to products
        </button>
        <span className="product-publish-celebration__redirect">Taking you there shortly…</span>
      </section>
    </div>
  );
}
