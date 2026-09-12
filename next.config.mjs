/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // The dev-tools bubble sits on top of the UI and lands in every screenshot.
  devIndicators: false,
  // trycloudfare for tunnel access; 127.0.0.1 so tools/shot.sh can load /_next/*
  allowedDevOrigins: ['*.trycloudfare.com', '127.0.0.1'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nhtxpinnvuqpfwnatqre.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
