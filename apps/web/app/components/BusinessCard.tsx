'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Heart, MapPin, Star } from 'lucide-react';
import type { Business } from '../data/mockData';

interface BusinessCardProps {
  business: Business;
  isFavorite: boolean;
  onToggleFavorite: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function BusinessCard({ business, isFavorite, onToggleFavorite }: BusinessCardProps) {
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-[#dce7e1] bg-white p-2 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#9bd3b6] hover:shadow-[0_14px_28px_rgba(5,41,31,0.08)]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#F2F3F0]">
        <img src={business.coverImage} alt={business.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        {business.topRated && <span className="absolute left-2.5 top-2.5 rounded-full bg-[#05291F] px-2.5 py-1 text-[10px] font-semibold text-white">Top rated</span>}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? `Remove ${business.name} from saved businesses` : `Save ${business.name}`}
          aria-pressed={isFavorite}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#49665a] shadow-sm transition hover:scale-105 hover:text-[#d34d68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#02924B]"
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-[#d34d68] text-[#d34d68]' : ''}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#658276]">
          <span className="truncate">{business.category}</span>
          {business.verified && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#02924B]" aria-label="Verified business" />}
        </div>
        <Link href={`/discover?id=${business.id}`} className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-5 text-[#05291F] transition-colors group-hover:text-[#02924B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#02924B]">
          {business.name}
        </Link>

        <div className="mt-2 flex items-center gap-1 text-[12px]">
          <Star className="h-3.5 w-3.5 fill-[#f2ae18] text-[#f2ae18]" aria-hidden="true" />
          <span className="font-semibold text-[#05291F]">{business.rating}</span>
          <span className="text-[#718c80]">({business.reviewsCount})</span>
          <span className="mx-0.5 text-[#bdd0c5]">·</span>
          <MapPin className="h-3.5 w-3.5 text-[#718c80]" aria-hidden="true" />
          <span className="truncate text-[#577367]">{business.location}</span>
        </div>

        <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#658276]">{business.description}</p>

        <div className="mt-4 flex items-end justify-between border-t border-[#e4ede8] pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#7c978a]">Starting from</p>
            <p className="mt-0.5 text-[15px] font-semibold text-[#05291F]">{business.startingPrice}</p>
          </div>
          <Link href={`/discover?id=${business.id}`} aria-label={`View ${business.name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f5ed] text-[#02924B] transition hover:bg-[#02924B] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#02924B]">
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
