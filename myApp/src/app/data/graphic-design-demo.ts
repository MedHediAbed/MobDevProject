import type { FreelancerProfile } from '../services/freelancer.service';

export interface StaticProposal {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  price: number;
  rating: number;
  ratingCount: number;
  thumbnail: string;
  freelancerId: string;
}

/** Extended fields used only for demo freelancer UI */
export interface DemoFreelancerExtra {
  phone?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  products?: Array<{
    title: string;
    image: string;
    rating: number;
    ratingCount: number;
    priceLabel: string;
  }>;
}

export type DemoFreelancerProfile = FreelancerProfile & DemoFreelancerExtra;

export const GRAPHIC_DESIGN_PROPOSALS: StaticProposal[] = [
  {
    id: 'gd-social-media',
    title: 'Social Media Design',
    shortDescription: 'I will design professional social media graphics f...',
    fullDescription:
      'I will design professional social media graphics for your brand across Instagram, Facebook, LinkedIn, and X. Deliverables include post templates, story layouts, and cover banners sized for each platform. I work from your brand guidelines and provide editable source files so your team can reuse layouts. Typical turnaround is 3–5 business days per batch, with two revision rounds included.',
    price: 25,
    rating: 4.9,
    ratingCount: 201,
    thumbnail: 'assets/gd-social-media.png',
    freelancerId: 'demo-freelancer-amelia',
  },
  {
    id: 'gd-logo-design',
    title: 'Logo Design',
    shortDescription: 'I will create a modern minimalist logo for your...',
    fullDescription:
      'I will create a modern minimalist logo for your startup or personal brand. You will receive multiple concept directions, a refined final mark, and variations for dark/light backgrounds. Package includes vector files (SVG, PDF) and raster exports (PNG) for web and print. One brand sheet summarizing colors and clear-space rules is included.',
    price: 15,
    rating: 4.7,
    ratingCount: 174,
    thumbnail: 'assets/gd-logo-design.png',
    freelancerId: 'demo-freelancer-marcus',
  },
  {
    id: 'gd-illustration',
    title: 'Illustration',
    shortDescription: 'I will design unique illustrations for games...',
    fullDescription:
      'I will design unique illustrations for games, editorials, or marketing campaigns in a bold, high-detail digital painting style. Work includes character sheets, key art, and background plates as needed. I deliver layered PSD or high-resolution PNG/TIFF files and can adapt to your art direction and mood boards.',
    price: 45,
    rating: 4.7,
    ratingCount: 108,
    thumbnail: 'assets/gd-illustration.png',
    freelancerId: 'demo-freelancer-lina',
  },
];

const DEMO_FREELANCERS: Record<string, DemoFreelancerProfile> = {
  'demo-freelancer-amelia': {
    _id: 'demo-freelancer-amelia',
    userId: null,
    name: 'Amelia Carter',
    email: 'amelia.carter@mail.com',
    phone: '+216 22 111 222',
    emailVerified: true,
    bio: 'Brand and social designer with 8+ years of experience helping SaaS and retail teams ship cohesive visuals.',
    skills: ['Social media', 'Figma', 'Brand kits'],
    portfolio: [{ title: 'Retail launch kit', url: 'https://example.com' }],
    cvUrl: '',
    status: 'approved',
    avatarUrl: '',
  },
  'demo-freelancer-marcus': {
    _id: 'demo-freelancer-marcus',
    userId: null,
    name: 'Marcus Nguyen',
    email: 'marcus.nguyen@mail.com',
    phone: '+216 55 333 444',
    emailVerified: true,
    bio: 'Logo and identity specialist focused on minimal, memorable marks for tech and creative studios.',
    skills: ['Logo design', 'Identity', 'Illustrator'],
    portfolio: [{ title: 'Identity case studies', url: 'https://example.com' }],
    cvUrl: '',
    status: 'approved',
    avatarUrl: '',
  },
  'demo-freelancer-lina': {
    _id: 'demo-freelancer-lina',
    userId: null,
    name: 'Lina Haddad',
    email: 'lina.haddad@mail.com',
    phone: '+216 98 777 888',
    emailVerified: true,
    bio: 'Illustrator and concept artist for games and campaigns; comfortable with stylized and painterly pipelines.',
    skills: ['Illustration', 'Concept art', 'Photoshop'],
    portfolio: [{ title: 'Game art portfolio', url: 'https://example.com' }],
    cvUrl: '',
    status: 'approved',
    avatarUrl: '',
  },
  /** Reference layout (Albert Flores) — can be opened directly via /freelancers/demo-albert-flores */
  'demo-albert-flores': {
    _id: 'demo-albert-flores',
    userId: null,
    name: 'Albert Flores',
    email: 'albertflores@mail.com',
    phone: '+216 99 999 999',
    emailVerified: true,
    bio: 'Product designer and UI kits builder. I ship polished mobile patterns and design systems for teams worldwide.',
    skills: ['UI/UX', 'Design systems', 'Mobile'],
    portfolio: [],
    cvUrl: '',
    status: 'approved',
    products: [
      {
        title: 'GoFoodies Mobile App UIKits',
        image: 'assets/gd-social-media.png',
        rating: 5,
        ratingCount: 873,
        priceLabel: '$99',
      },
    ],
  },
};

export function getGraphicDesignProposal(id: string): StaticProposal | undefined {
  return GRAPHIC_DESIGN_PROPOSALS.find((p) => p.id === id);
}

export function getDemoFreelancer(id: string): DemoFreelancerProfile | undefined {
  return DEMO_FREELANCERS[id];
}

export function isDemoFreelancerId(id: string): boolean {
  return id in DEMO_FREELANCERS;
}
