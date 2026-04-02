/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['*.trycloudfare.com'],
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
