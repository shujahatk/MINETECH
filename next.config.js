/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'twilio', '@sendgrid/mail', 'bcryptjs'],
  },
};

module.exports = nextConfig;
