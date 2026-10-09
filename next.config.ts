import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/studio', destination: '/creator', permanent: false },
      { source: '/studio/:path*', destination: '/creator/:path*', permanent: false },
    ];
  },
};

export default nextConfig;
