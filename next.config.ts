// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb'
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bomxvxsoiokzjbdzfrnt.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  }
}

export default nextConfig
