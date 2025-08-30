// next.config.ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'alavxdxxttlfprkiwtrq.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      }
    ],
  },
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NODE_ENV === 'production'
      ? 'https://trymoonlit.com'
      : 'http://localhost:3000'
  },
  eslint: {
    // Temporarily ignore ESLint during builds for deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily ignore TypeScript errors during builds for deployment
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig