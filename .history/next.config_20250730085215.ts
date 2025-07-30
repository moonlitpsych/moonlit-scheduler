// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['your-supabase-project.supabase.co'], // Add your Supabase storage domain
  },
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NODE_ENV === 'production'
      ? 'https://your-production-domain.com'
      : 'http://localhost:3000'
  }
}