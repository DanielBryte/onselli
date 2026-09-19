'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Star,
  CheckCircle2,
  Heart,
  X,
  ArrowRight,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { MOCK_BUSINESSES, CATEGORIES, Business } from '../data/mockData';

function DiscoverContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || 'All';
  const initialLocation = searchParams.get('location') || 'All';

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState('relevance');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedLocation('All');
    setMaxPrice(100000);
    setVerifiedOnly(false);
    setTopRatedOnly(false);
    setMinRating(0);
    setSortBy('relevance');
  };

  // Dynamic Filtering Logic
  const filteredBusinesses = useMemo(() => {
    return MOCK_BUSINESSES.filter((biz) => {
      // Search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = biz.name.toLowerCase().includes(q);
        const matchesCat = biz.category.toLowerCase().includes(q);
        const matchesTags = biz.tags.some((t) => t.toLowerCase().includes(q));
        const matchesDesc = biz.description.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesTags && !matchesDesc) {
          return false;
        }
      }

      // Category matching
      if (selectedCategory !== 'All' && biz.category !== selectedCategory) {
        return false;
      }

      // Location matching
      if (selectedLocation !== 'All' && !biz.location.toLowerCase().includes(selectedLocation.toLowerCase())) {
        return false;
      }

      // Verification matching
      if (verifiedOnly && !biz.verified) {
        return false;
      }

      // Top rated matching
      if (topRatedOnly && !biz.topRated) {
        return false;
      }

      // Rating score
      if (minRating > 0 && biz.rating < minRating) {
        return false;
      }

      // Price Filter
      const numericPrice = parseInt(biz.startingPrice.replace(/[^0-9]/g, '')) || 0;
      if (numericPrice > maxPrice) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'reviews') return b.reviewsCount - a.reviewsCount;
      if (sortBy === 'price-low') {
        const pA = parseInt(a.startingPrice.replace(/[^0-9]/g, '')) || 0;
        const pB = parseInt(b.startingPrice.replace(/[^0-9]/g, '')) || 0;
        return pA - pB;
      }
      return 0;
    });
  }, [
    searchQuery,
    selectedCategory,
    selectedLocation,
    verifiedOnly,
    topRatedOnly,
    minRating,
    maxPrice,
    sortBy
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f7fcf9]">
      <Header activeTab="explore" />

      {/* Top Title Banner */}
      <div className="bg-[#073827] text-white py-10 px-4 sm:px-6">
        <div className="max-w-[1240px] mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-[#00a859] font-bold text-[12px] uppercase tracking-wider block mb-1">
                DISCOVER & EXPLORE
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Find trusted businesses & services
              </h1>
            </div>

            {/* Quick Search Input */}
            <div className="w-full md:w-auto min-w-[320px] bg-white/10 backdrop-blur-md rounded-full p-1.5 border border-white/20 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#a3cbba] ml-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, service or keyword..."
                className="w-full bg-transparent text-white placeholder-[#8ea89d] text-[13px] outline-none border-none p-0 pr-3"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 hover:text-white text-[#a3cbba]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Discover Layout */}
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Mobile Filter Toggle Button */}
          <div className="lg:hidden flex items-center justify-between pb-4 border-b border-[#e2efe7]">
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#d2e4da] text-[#073827] font-bold text-[13px] shadow-xs"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#00a859]" />
              <span>Full Filters</span>
            </button>

            <span className="text-[13px] text-[#527063] font-medium">
              Showing {filteredBusinesses.length} results
            </span>
          </div>

          {/* Desktop Filter Sidebar */}
          <aside
            className={`fixed inset-0 z-50 bg-black/40 lg:static lg:bg-transparent lg:z-auto ${
              isMobileFilterOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="fixed inset-y-0 left-0 w-80 bg-white p-6 overflow-y-auto lg:static lg:w-72 lg:p-6 lg:rounded-2xl lg:border lg:border-[#e2efe7] lg:shadow-xs space-y-6">
              {/* Filter Sidebar Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#e2efe7]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#00a859]" />
                  <h2 className="font-extrabold text-[#073827] text-[16px]">
                    Full Filters
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetFilters}
                    className="text-[11.5px] font-bold text-[#00a859] hover:underline flex items-center gap-1"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                  <button
                    onClick={() => setIsMobileFilterOpen(false)}
                    className="lg:hidden p-1 text-[#6b897c]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <h3 className="font-bold text-[#073827] text-[13.5px] mb-2.5">
                  Category
                </h3>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setSelectedCategory('All')}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                      selectedCategory === 'All'
                        ? 'bg-[#00a859] text-white font-bold'
                        : 'text-[#3e5d50] hover:bg-[#f0f8f4]'
                    }`}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.title)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                        selectedCategory === cat.title
                          ? 'bg-[#00a859] text-white font-bold'
                          : 'text-[#3e5d50] hover:bg-[#f0f8f4]'
                      }`}
                    >
                      {cat.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Filter */}
              <div>
                <h3 className="font-bold text-[#073827] text-[13.5px] mb-2.5">
                  Location
                </h3>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#00a859] absolute left-3 top-2.5" />
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#d2e4da] bg-[#f9fcfb] text-[13px] font-medium text-[#073827] outline-none"
                  >
                    <option value="All">All Locations</option>
                    <option value="Lagos">Lagos</option>
                    <option value="Abuja">Abuja</option>
                    <option value="Port Harcourt">Port Harcourt</option>
                    <option value="Ibadan">Ibadan</option>
                  </select>
                </div>
              </div>

              {/* Maximum Price Range Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#073827] text-[13.5px]">
                    Max Starting Price
                  </h3>
                  <span className="text-[12px] font-bold text-[#00a859]">
                    ₦{maxPrice.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={100000}
                  step={5000}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-[#00a859] cursor-pointer"
                />
              </div>

              {/* Badges & Trust Toggles */}
              <div>
                <h3 className="font-bold text-[#073827] text-[13.5px] mb-2.5">
                  Trust Signals
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-[13px] text-[#3e5d50] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={verifiedOnly}
                      onChange={(e) => setVerifiedOnly(e.target.checked)}
                      className="w-4 h-4 rounded text-[#00a859] accent-[#00a859]"
                    />
                    <span>Verified Businesses Only</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-[13px] text-[#3e5d50] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={topRatedOnly}
                      onChange={(e) => setTopRatedOnly(e.target.checked)}
                      className="w-4 h-4 rounded text-[#00a859] accent-[#00a859]"
                    />
                    <span>Top Rated Only</span>
                  </label>
                </div>
              </div>

              {/* Minimum Rating */}
              <div>
                <h3 className="font-bold text-[#073827] text-[13.5px] mb-2">
                  Minimum Rating
                </h3>
                <div className="flex items-center gap-1.5">
                  {[0, 4.0, 4.5, 4.8].map((score) => (
                    <button
                      key={score}
                      onClick={() => setMinRating(score)}
                      className={`px-3 py-1 rounded-lg text-[12px] font-bold border transition-colors ${
                        minRating === score
                          ? 'bg-[#00a859] text-white border-[#00a859]'
                          : 'bg-white text-[#3e5d50] border-[#d2e4da] hover:bg-[#f0f8f4]'
                      }`}
                    >
                      {score === 0 ? 'Any' : `${score}+ ★`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Results Area */}
          <div className="flex-1">
            {/* Results Header Bar */}
            <div className="hidden lg:flex items-center justify-between pb-4 mb-6 border-b border-[#e2efe7]">
              <div className="text-[14px] text-[#527063] font-medium">
                Showing <b className="text-[#073827]">{filteredBusinesses.length}</b> businesses
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#658577]">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[#d2e4da] bg-white text-[13px] font-semibold text-[#073827] outline-none cursor-pointer"
                >
                  <option value="relevance">Relevance</option>
                  <option value="rating">Highest Rated</option>
                  <option value="reviews">Most Reviews</option>
                  <option value="price-low">Price: Low to High</option>
                </select>
              </div>
            </div>

            {/* Business Cards Grid */}
            {filteredBusinesses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredBusinesses.map((biz) => (
                  <article
                    key={biz.id}
                    className="group bg-white rounded-2xl border border-[#e2efe7] overflow-hidden hover:shadow-[0_16px_36px_rgba(7,56,39,0.09)] hover:border-[#00a859]/40 transition-all duration-300 flex flex-col"
                  >
                    {/* Cover Image */}
                    <div className="relative h-44 w-full bg-[#e8f2ec] overflow-hidden">
                      <img
                        src={biz.coverImage}
                        alt={biz.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/20" />

                      {/* Badges */}
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                        {biz.topRated ? (
                          <span className="px-2.5 py-1 rounded-full bg-[#fff4db] text-[#b76e00] text-[10.5px] font-bold shadow-xs">
                            Top Rated
                          </span>
                        ) : biz.verified ? (
                          <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs text-[#00a859] text-[10.5px] font-bold flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-[#00a859]" />
                            Verified
                          </span>
                        ) : null}
                      </div>

                      {/* Heart Button */}
                      <button
                        onClick={(e) => toggleFavorite(biz.id, e)}
                        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white backdrop-blur-xs flex items-center justify-center text-[#425b6c] hover:text-[#e44367] transition-all shadow-xs"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            favorites[biz.id] ? 'fill-[#e44367] text-[#e44367]' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start gap-3 mb-2.5">
                          <div
                            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[12px]"
                            style={{ backgroundColor: biz.avatarBg }}
                          >
                            {biz.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[#073827] text-[14px] leading-snug truncate group-hover:text-[#00a859] transition-colors">
                              {biz.name}
                            </h3>
                            <div className="flex items-center gap-1 text-[12px] mt-0.5">
                              <Star className="w-3.5 h-3.5 fill-[#00a859] text-[#00a859]" />
                              <span className="font-bold text-[#073827]">{biz.rating}</span>
                              <span className="text-[#7d998c]">({biz.reviewsCount})</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-[11.5px] font-semibold text-[#4e6b5e] flex items-center gap-1 mb-2">
                          <MapPin className="w-3 h-3 text-[#7d998c]" />
                          <span>{biz.location}</span>
                          <span className="text-[#a4beaf]">·</span>
                          <span className="text-[#658577]">{biz.distance}</span>
                        </p>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {biz.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-md bg-[#f0f7f3] text-[#3b5e4f] text-[10.5px] font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <p className="text-[11.5px] text-[#5c7a6c] line-clamp-2 leading-relaxed mb-4">
                          {biz.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#e2efe7] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#718c80] block">Starting</span>
                          <span className="font-extrabold text-[#073827] text-[13.5px]">
                            {biz.startingPrice}
                          </span>
                        </div>

                        <button className="text-[12px] font-bold text-[#00a859] hover:text-[#008f4c] flex items-center gap-1 group/btn">
                          <span>View profile</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="bg-white rounded-2xl border border-[#e2efe7] p-12 text-center max-w-md mx-auto my-8">
                <Search className="w-12 h-12 text-[#9ec4b3] mx-auto mb-3" />
                <h3 className="font-bold text-[#073827] text-[17px] mb-1">
                  No businesses found
                </h3>
                <p className="text-[13px] text-[#658577] mb-6">
                  Try adjusting your search keywords or clearing some filters to see more results.
                </p>
                <button
                  onClick={resetFilters}
                  className="px-5 py-2.5 rounded-full bg-[#00a859] text-white font-bold text-[13px] hover:bg-[#008f4c] transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#073827]">Loading discover page...</div>}>
      <DiscoverContent />
    </Suspense>
  );
}
