/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
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
