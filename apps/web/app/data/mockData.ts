export interface Business {
  id: string;
  name: string;
  initials: string;
  category: string;
  categorySlug: string;
  tags: string[];
  location: string;
  distance: string;
  rating: number;
  reviewsCount: number;
  startingPrice: string;
  verified: boolean;
  topRated: boolean;
  coverImage: string;
  avatarBg: string;
  description: string;
  phone?: string;
}

export interface Category {
  id: string;
  title: string;
  subtext: string;
  iconName: string;
  bgHex: string;
  iconColor: string;
}

export const POPULAR_SEARCHES = [
  'Tailor',
  'Furniture maker',
  'Phone repair',
  'Plumber',
  'Graphic designer',
  'Catering',
  'Makeup artist',
  'Solar installation',
];

export const CATEGORIES: Category[] = [
  {
    id: 'fashion',
    title: 'Fashion & Clothing',
    subtext: 'Tailors · Designers · Stores',
    iconName: 'Shirt',
    bgHex: '#FFF4E5',
    iconColor: '#E65100',
  },
  {
    id: 'furniture',
    title: 'Furniture & Home',
    subtext: 'Makers · Decor · Repairs',
    iconName: 'Sofa',
    bgHex: '#E8F5E9',
    iconColor: '#00a859',
  },
  {
    id: 'electronics',
    title: 'Phones & Electronics',
    subtext: 'Sales · Repairs · Accessories',
    iconName: 'Smartphone',
    bgHex: '#E3F2FD',
    iconColor: '#1565C0',
  },
  {
    id: 'home-services',
    title: 'Home Services',
    subtext: 'Plumbers · Electricians · AC',
    iconName: 'Wrench',
    bgHex: '#E0F7FA',
    iconColor: '#00838F',
  },
  {
    id: 'beauty',
    title: 'Beauty & Personal Care',
    subtext: 'Salons · Spas · Wellness',
    iconName: 'Sparkles',
    bgHex: '#FCE4EC',
    iconColor: '#C2185B',
  },
  {
    id: 'food',
    title: 'Food & Beverages',
    subtext: 'Restaurants · Catering · Snacks',
    iconName: 'Utensils',
    bgHex: '#F3E5F5',
    iconColor: '#6A1B9A',
  },
];

export const MOCK_BUSINESSES: Business[] = [
  {
    id: 'ade-fashion',
    name: 'Ade Fashion House',
    initials: 'AF',
    category: 'Fashion & Clothing',
    categorySlug: 'fashion',
    tags: ['Fashion Designer', 'Clothing Store'],
    location: 'Lagos',
    distance: '2.4 km',
    rating: 4.8,
    reviewsCount: 124,
    startingPrice: '₦25,000',
    verified: true,
    topRated: true,
    coverImage: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80',
    avatarBg: '#073827',
    description: 'Custom outfits, native wear, tailored suits and modern fashion designs for every special occasion.',
    phone: '+234 803 123 4567'
  },
  {
    id: 'prime-woodworks',
    name: 'Prime Woodworks',
    initials: 'PW',
    category: 'Furniture & Home',
    categorySlug: 'furniture',
    tags: ['Furniture Maker', 'Custom Furniture'],
    location: 'Lagos',
    distance: '3.1 km',
    rating: 4.9,
    reviewsCount: 87,
    startingPrice: '₦50,000',
    verified: true,
    topRated: true,
    coverImage: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    avatarBg: '#00a859',
    description: 'Custom furniture, wardrobes, TV consoles, and interior woodwork solutions for modern homes & offices.',
    phone: '+234 802 987 6543'
  },
  {
    id: 'gadget-town',
    name: 'Gadget Town',
    initials: 'GT',
    category: 'Phones & Electronics',
    categorySlug: 'electronics',
    tags: ['Phone Sales', 'Repairs', 'Accessories'],
    location: 'Lagos',
    distance: '1.8 km',
    rating: 4.6,
    reviewsCount: 203,
    startingPrice: '₦45,000',
    verified: true,
    topRated: false,
    coverImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
    avatarBg: '#1565C0',
    description: 'Latest iPhones, Android phones, accessories, laptop sales and fast certified repair services.',
    phone: '+234 814 555 0192'
  },
  {
    id: 'lagos-plumbing',
    name: 'Lagos Plumbing Solutions',
    initials: 'LS',
    category: 'Home Services',
    categorySlug: 'home-services',
    tags: ['Plumber', 'Home Repair', 'Installation'],
    location: 'Lagos',
    distance: '4.2 km',
    rating: 4.7,
    reviewsCount: 96,
    startingPrice: '₦15,000',
    verified: true,
    topRated: false,
    coverImage: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80',
    avatarBg: '#00838F',
    description: 'Reliable plumbing services for homes and businesses. Water tank installation, leak repair & piping.',
    phone: '+234 809 333 4411'
  },
  {
    id: 'tasty-bites',
    name: 'Tasty Bites Catering',
    initials: 'TB',
    category: 'Food & Beverages',
    categorySlug: 'food',
    tags: ['Catering', 'Restaurant', 'Snacks'],
    location: 'Lagos',
    distance: '5.7 km',
    rating: 4.9,
    reviewsCount: 312,
    startingPrice: '₦3,000',
    verified: true,
    topRated: true,
    coverImage: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80',
    avatarBg: '#E65100',
    description: 'Delicious party food, Jollof rice, small chops, finger foods, and full event catering services.',
    phone: '+234 801 777 8899'
  },
  {
    id: 'glam-studio',
    name: 'Glamour Beauty & Spa',
    initials: 'GB',
    category: 'Beauty & Personal Care',
    categorySlug: 'beauty',
    tags: ['Makeup Artist', 'Spa', 'Nail Salon'],
    location: 'Lagos',
    distance: '2.0 km',
    rating: 4.8,
    reviewsCount: 154,
    startingPrice: '₦12,000',
    verified: true,
    topRated: true,
    coverImage: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80',
    avatarBg: '#C2185B',
    description: 'Bridal makeup, hair styling, facial therapy, manicure, pedicure & relaxing body spa treats.',
    phone: '+234 806 444 3322'
  }
];
