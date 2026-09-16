/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Allow importing from project root (core/ modules)
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },

  // Webpack config: explicit path aliases + core/ externals
  webpack: (config, { isServer }) => {
    // Explicitly resolve @/ → src/ and @core/ → core/
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    config.resolve.alias['@core'] = path.join(__dirname, 'core');

    // On the server side, mark core/ modules as external so they resolve at runtime
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '../../core/lib/db': 'commonjs ../../core/lib/db',
        '../../core/intelligence/ai-provider': 'commonjs ../../core/intelligence/ai-provider',
        '../../../core/lib/db': 'commonjs ../../../core/lib/db',
        '../../../core/intelligence/ai-provider': 'commonjs ../../../core/intelligence/ai-provider',
      });
    }

    return config;
  },

  // Disable image optimization for Render (no local storage)
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
