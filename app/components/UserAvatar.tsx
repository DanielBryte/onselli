'use client';

import { useState } from 'react';
import Image from 'next/image';

type UserAvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: number;
  shape?: 'circle' | 'square';
  className?: string;
};

const palettes = ['sun', 'mint', 'blue', 'peach', 'rose', 'lilac'] as const;

function paletteFor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return palettes[Math.abs(hash) % palettes.length];
}

export default function UserAvatar({
  name,
  imageUrl,
  size = 40,
  shape = 'circle',
  className = '',
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <span
      className={`user-avatar user-avatar--${shape} user-avatar--${paletteFor(name)} ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name || 'User'} avatar`}
    >
      {showImage ? (
        <Image
          src={imageUrl!}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="user-avatar__image"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <svg className="user-avatar__silhouette" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="22" r="10.5" />
          <path d="M7 59c1.7-11.2 11.8-19.5 25-19.5S55.3 47.8 57 59v5H7z" />
        </svg>
      )}
    </span>
  );
}
