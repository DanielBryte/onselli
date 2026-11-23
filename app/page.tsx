import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Check, Link2, Search, ShoppingBag, Video } from 'lucide-react';
import Header from './components/Header';
import Logo from './components/Logo';
import HomePricing from './components/HomePricing';

export const metadata = {
  title: 'Turn what you know into what you earn | Onselli',
  description:
    'Build a premium home for your knowledge business with courses, digital products, workshops, and a creator storefront that sells with clarity.',
};

const offers = [
  { kind: 'WORKSHOP', title: 'The Brand Clarity Workshop', detail: 'A practical place to start', price: '₦18,000', color: 'sage' },
  { kind: 'FIELD GUIDE', title: 'The Creator’s Brand Playbook', detail: 'A resource to keep close', price: '₦8,500', color: 'cream' },
];

const creatorRows = [
  [
    { name: 'Maya', role: 'Educators', photo: 'photo-1534528741775-53994a69daeb' },
    { name: 'Jamal', role: 'Creators', photo: 'photo-1500648767791-00dcc994a43e' },
    { name: 'Nia', role: 'Coaches', photo: 'photo-1524504388940-b1c1722653e1' },
    { name: 'Sofia', role: 'Artists', photo: 'photo-1531123897727-8f129e1688ce' },
    { name: 'Noah', role: 'Writers', photo: 'photo-1506794778202-cad84cf45f1d' },
    { name: 'Amara', role: 'Experts', photo: 'photo-1544005313-94ddf0286df2' },
  ],
  [
    { name: 'Alex', role: 'Podcasters', photo: 'photo-1535713875002-d1d0cf377fde' },
    { name: 'Leila', role: 'Designers', photo: 'photo-1508214751196-bcfd4ca60f91' },
    { name: 'Theo', role: 'Founders', photo: 'photo-1507003211169-0a1dd7228f2d' },
    { name: 'Zara', role: 'Athletes', photo: 'photo-1534528741775-53994a69daeb' },
    { name: 'Chris', role: 'Streamers', photo: 'photo-1500648767791-00dcc994a43e' },
    { name: 'Ivy', role: 'Authors', photo: 'photo-1531123897727-8f129e1688ce' },
  ],
];

export default function HomePage() {
  return (
    <main className="home-page" id="top">
      <Header />

      <section className="home-hero">
        <div className="home-hero__panel">
          <div className="home-hero__glow" aria-hidden="true" />
          <div className="home-hero__inner">
            <div className="home-hero__copy">
              <span className="home-eyebrow">YOUR COMPLETE CREATOR PLATFORM</span>
              <h1>Turn what you know<br />into <span>what you earn.</span></h1>
              <p className="home-hero__lede">Build a home for your knowledge. Create courses, downloads, workshops, or coaching—and sell them to the audience you’ve already grown.</p>
              <div className="home-hero__actions">
                <Link href="/signup" className="home-button home-button--hero">Start for free <ArrowRight size={17} /></Link>
                <Link href="#how-it-works" className="home-button home-button--quiet">See how it works <ArrowRight size={16} /></Link>
              </div>
              <div className="home-platform-note"><span>One home for everything you know</span><div className="home-platform-list"><b>Courses</b><i /><b>Downloads</b><i /><b>Workshops</b><i /><b>Coaching</b></div></div>
            </div>

            <div className="home-product" role="group" aria-label="Safari browser preview of a creator storefront">
              <div className="home-product__chrome">
                <span className="home-product__traffic"><i /><i /><i /></span>
                <span className="home-product__browser-actions"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></i><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i></span>
                <span className="home-product__address"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><small>onselli.com/c/amara-ade</small><svg className="home-product__reload" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4.9 9a7.5 7.5 0 0 1 12.6-2L20 12M4 17v-5h5m10.1 3a7.5 7.5 0 0 1-12.6 2L4 12"/></svg></span>
                <span className="home-product__toolbar-icons"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8v8H8z"/></svg></span>
              </div>
              <div className="home-product__viewport">
                <div className="home-product__sitebar">
                  <span className="home-product__store-brand"><Image src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&h=80&q=85" alt="" width={38} height={38} unoptimized/></span>
                  <nav aria-label="Sample storefront navigation"><span className="is-active">All products</span><span>Products</span><span>Store</span></nav>
                  <span className="home-product__store-actions"><small><ShoppingBag size={12}/> Cart</small><small>NGN⌄</small><small>Log in</small></span>
                </div>
                <div className="home-product__storefront">
                  <section className="home-product__profile">
                    <Image className="home-product__avatar" src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=180&h=180&q=85" alt="" width={76} height={76} unoptimized/>
                    <div className="home-product__profile-details"><h2>Amara Ade</h2><p>@amara-ade</p><span>AMARA ADE’S STORE</span><small>Brand strategist helping creators build clear, confident brands.</small></div>
                  </section>
                  <section className="home-product__catalog">
                    <div className="home-product__catalog-head"><h3>All products</h3><span><Search size={12}/> Search products</span></div>
                    <div className="home-product__catalog-grid">{offers.map((offer) => <article className="home-product__card" key={offer.title}>
                      <div className={`home-product__card-art home-product__card-art--${offer.color}`}><BookOpen size={23}/></div>
                      <div className="home-product__card-body"><small>{offer.kind}</small><b>{offer.title}</b><p>{offer.detail}</p><footer><strong>{offer.price}</strong><ArrowRight size={14}/></footer></div>
                    </article>)}</div>
                  </section>
                </div>
              </div>
              <div className="home-float home-float--top"><span className="home-float__icon"><Link2 size={15}/></span><span><b>One link to share</b><small>Your work, in one place</small></span></div>
              <div className="home-float home-float--bottom"><span className="home-float__icon"><Check size={15}/></span><span><b>Payment confirmed</b><small>Learning access unlocked</small></span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="creator-types" id="for-creators">
        <div className="creator-types__intro"><p className="section-overline">Onselli is for the knowledge you carry</p><h2>Earn from what you know.</h2></div>
        <div className="creator-marquee" aria-label="Creators who can build on Onselli">
          {creatorRows.map((row, rowIndex) => <div className="creator-marquee__window" key={rowIndex}><div className={`creator-marquee__track${rowIndex === 0 ? ' creator-marquee__track--left' : ' creator-marquee__track--right'}`} aria-hidden="true">{[...row, ...row].map((creator, index) => <article className="creator-type" key={`${creator.name}-${index}`}><Image className="creator-type__portrait" src={`https://images.unsplash.com/${creator.photo}?auto=format&fit=crop&w=180&h=180&q=85`} alt="" width={88} height={88} unoptimized/><span>{creator.role}</span></article>)}</div></div>)}
        </div>
      </section>

      <section className="channel-section" id="how-it-works">
        <div className="creator-orbit">
          <div className="creator-orbit__icons" aria-hidden="true">
            <span className="orbit-icon orbit-icon--framer"><img src="https://cdn.simpleicons.org/framer/0055FF" alt="" /></span>
            <span className="orbit-icon orbit-icon--stripe"><img src="https://cdn.simpleicons.org/stripe/635BFF" alt="" /></span>
            <span className="orbit-icon orbit-icon--canva"><img src="/icons/canva.svg" alt="" /></span>
            <span className="orbit-icon orbit-icon--notion"><img src="https://cdn.simpleicons.org/notion/000000" alt="" /></span>
            <span className="orbit-icon orbit-icon--figma"><img src="https://cdn.simpleicons.org/figma/F24E1E" alt="" /></span>
            <span className="orbit-icon orbit-icon--wordpress"><img src="https://cdn.simpleicons.org/wordpress/21759B" alt="" /></span>
            <span className="orbit-icon orbit-icon--youtube"><img src="https://cdn.simpleicons.org/youtube/FF0033" alt="" /></span>
            <span className="orbit-icon orbit-icon--tiktok"><img src="https://cdn.simpleicons.org/tiktok/000000" alt="" /></span>
            <span className="orbit-icon orbit-icon--instagram"><img src="https://cdn.simpleicons.org/instagram/E4405F" alt="" /></span>
            <span className="orbit-icon orbit-icon--discord"><img src="https://cdn.simpleicons.org/discord/5865F2" alt="" /></span>
            <span className="orbit-icon orbit-icon--x"><img src="https://cdn.simpleicons.org/x/000000" alt="" /></span>
            <span className="orbit-icon orbit-icon--google"><img src="https://cdn.simpleicons.org/google/4285F4" alt="" /></span>
          </div>
          <div className="creator-orbit__content">
            <span className="creator-orbit__brand"><Logo/></span>
            <span className="section-overline">YOUR COMPLETE CREATOR PLATFORM</span>
            <h2>Everything you need<br/>to earn from <em>what you know.</em></h2>
            <p>Stop stitching together a website, payment links, course tools, and a community. Bring your knowledge and business together in one place - with a home that’s yours.</p>
            <Link href="/signup" className="home-button home-button--green">Start for free <ArrowRight size={17}/></Link>
          </div>
        </div>
      </section>

      <section className="home-feature-panel" id="platform">
        <div className="home-feature-panel__copy"><span className="section-overline">A BUSINESS THAT FEELS LIKE YOURS</span><h2>Create, share,<br/>and grow <em>your way.</em></h2><p>Build a home for your knowledge business with your offers, your voice, and a learning experience your audience can return to.</p><Link href="/signup" className="home-button home-button--green">Get started — it’s free <ArrowRight size={17}/></Link></div>
        <div className="feature-visual" aria-label="Preview of an Onselli creator workspace"><div className="feature-visual__orb feature-visual__orb--one"/><div className="feature-visual__orb feature-visual__orb--two"/><div className="feature-visual__card"><div className="feature-visual__top"><span>YOUR CREATOR SPACE</span><span className="feature-visual__status">● LIVE</span></div><div className="feature-visual__avatar">AA</div><b>Amara’s studio</b><small>Ideas worth learning from.</small><div className="feature-visual__progress"><i/><i/><i/></div><div className="feature-visual__offer"><span><Video size={17}/></span><div><b>Build a brand that feels like you</b><small>Course · 6 lessons</small></div><ArrowRight size={16}/></div><div className="feature-visual__offer"><span><BookOpen size={17}/></span><div><b>The Brand Clarity Workbook</b><small>Digital guide · instant access</small></div><ArrowRight size={16}/></div></div></div>
      </section>

      <section className="home-offers-section">
        <div className="home-offers-section__head"><div><span className="section-overline">ONE PLATFORM. ROOM TO EXPAND.</span><h2>Build the kind of<br/>business <em>you believe in.</em></h2></div><p>Start with the simplest way to share what you know. Add more ways to teach as your community grows.</p></div>
        <div className="home-offer-grid">
          <article className="home-offer-card"><div className="home-offer-card__art offer-art--learn"><span>01 / TEACH</span><div className="offer-art__course"><BookOpen size={18}/><b>THE CREATOR<br/>FIELD GUIDE</b><small>5 lessons · learn at your pace</small></div></div><div className="home-offer-card__body"><h3>Teach it your way.</h3><p>Turn your process into courses, workshops, or coaching that help someone take their next step.</p><Link href="/signup">Create an offer <ArrowRight size={15}/></Link></div></article>
          <article className="home-offer-card"><div className="home-offer-card__art offer-art--sell"><span>02 / SELL</span><div className="offer-art__store"><small>AMARA ADE · CREATOR</small><b>Your next<br/>good idea<br/>starts here.</b><i>onselli.com/c/amara</i></div></div><div className="home-offer-card__body"><h3>Make it easy to find you.</h3><p>Give every offer a place in a creator storefront designed around your work and your voice.</p><Link href="/signup">Build your page <ArrowRight size={15}/></Link></div></article>
          <article className="home-offer-card"><div className="home-offer-card__art offer-art--grow"><span>03 / GROW</span><div className="offer-art__receipt"><span>NEW ENROLLMENT</span><b>Brand Clarity<br/>Workshop</b><small>Access unlocked <Check size={13}/></small></div><div className="offer-art__spark">✳</div></div><div className="home-offer-card__body"><h3>Keep the learning going.</h3><p>Make checkout and buyer access feel like one clear journey, from first click to first lesson.</p><Link href="/signup">See how it works <ArrowRight size={15}/></Link></div></article>
        </div>
      </section>

      <HomePricing />

      <section className="home-last-call" aria-labelledby="home-last-call-title">
        <div className="home-last-call__inner">
          <span className="home-last-call__eyebrow">YOUR KNOWLEDGE HAS VALUE</span>
          <h2 id="home-last-call-title">What you know can<br/>take someone further.</h2>
          <p>Give your next great idea a home—and make it easy for people to learn from you.</p>
          <Link href="/signup" className="home-button home-button--white">Start for free <ArrowRight size={20}/></Link>
          <span className="home-last-call__spark" aria-hidden="true">✳</span>
        </div>
      </section>

      <footer className="home-footer" id="company">
        <div className="home-footer__inner">
          <div className="home-footer__columns">
            <div className="home-footer__column"><h2>Product</h2><Link href="#platform">The platform</Link><Link href="#how-it-works">How it works</Link><Link href="/signup">Courses & workshops</Link><Link href="/signup">Digital products</Link><Link href="/signup">Creator storefront</Link></div>
            <div className="home-footer__column"><h2>Explore</h2><Link href="/discover">Find creators</Link><Link href="#for-creators">Who it’s for</Link><Link href="/discover">Creator stories</Link><Link href="/signup">Start selling</Link></div>
            <div className="home-footer__column"><h2>Resources</h2><Link href="#how-it-works">Getting started</Link><Link href="#platform">Create an offer</Link><a href="mailto:support@onselli.com?subject=Onselli%20support">Help & support</a><a href="mailto:support@onselli.com">Contact us</a></div>
            <div className="home-footer__column"><h2>Legal</h2><Link href="/legal/terms">Terms of Service</Link><Link href="/legal/privacy">Privacy Policy</Link><Link href="/legal/cookies">Cookie Policy</Link><a href="mailto:support@onselli.com">support@onselli.com</a></div>
          </div>
          <div className="home-footer__bottom"><Link href="/" className="home-footer__brand"><Logo/><span className="home-footer__tagline">Made for what you know.</span></Link><small>© {new Date().getFullYear()} Onselli. Built for what you know.</small><a className="home-footer__locale" href="#top">◎ English</a></div>
        </div>
      </footer>
    </main>
  );
}
