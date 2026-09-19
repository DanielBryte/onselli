import React from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import PopularBusinesses from './components/PopularBusinesses';
import ValueProps from './components/ValueProps';
import BusinessCta from './components/BusinessCta';
import Footer from './components/Footer';

export const metadata = {
  title: 'Onselli - Discover Businesses, Products and Services Near You',
  description: 'Find trusted businesses, explore quality products and services, and connect directly across Nigeria with Onselli. Run. Sell. Grow.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#073827] selection:bg-[#00a859] selection:text-white">
      {/* Navigation Header */}
      <Header activeTab="home" />

      {/* Main Page Flow */}
      <main className="flex-1">
        {/* Hero Section */}
        <HeroSection />

        {/* Popular Businesses Section */}
        <PopularBusinesses />

        {/* Value Proposition / Trust Pillars Section */}
        <ValueProps />

        {/* Merchant SME Business CTA Section */}
        <BusinessCta />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
