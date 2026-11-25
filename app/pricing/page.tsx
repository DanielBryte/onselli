import type { Metadata } from 'next';
import Header from '@/app/components/Header';
import HomePricing from '@/app/components/HomePricing';
import PublicFooter from '@/app/components/PublicFooter';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Compare Onselli plans for creators and teams. Start free and upgrade as your knowledge business grows.',
};

export default function PricingPage() {
  return <main className="min-h-screen bg-white text-ink">
    <Header />
    <HomePricing asPage />
    <PublicFooter />
  </main>;
}
