import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = Array.isArray(config.externals) ? config.externals : [];
      if (!config.externals.includes('handlebars')) {
        config.externals.push('handlebars');
      }
    }
    return config;
  },
  outputFileTracingIncludes: {
    'src/lib/generation.ts': [
      './public/games/**',
      './public/images/img-casino/**'
    ],
  },
};

export default nextConfig;
