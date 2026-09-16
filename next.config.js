/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for Render deployment
  output: 'standalone',
  
  // Allow importing from project root (core/ modules)
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },

  // Webpack config for project-root modules
  webpack: (config, { isServer }) => {
    // Allow require('../../core/...') from src/app/api/ routes
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },

  // Disable image optimization for Render (no local storage)
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
