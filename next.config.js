/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  swcMinify: true,
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'twilio', 'bcryptjs', 'mongodb', 'pdf-parse', 'mammoth', '@napi-rs/canvas'],
    outputFileTracingIncludes: {
      '/api/campaigns/intelligent/templates': [
        './node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs',
        './node_modules/pdf-parse/dist/pdf-parse/cjs/**/*',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      ],
      '/api/**/*': [
        './node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' https:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https: fonts.googleapis.com; font-src 'self' data: https: fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss:;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
