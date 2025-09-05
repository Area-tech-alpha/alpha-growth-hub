/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nfwfolrcpaxqwgkzzfok.supabase.co",
      },
      {
        protocol: "https",
        hostname: "assessorialpha.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "izmzxqzcsnaykofpcjjh.supabase.co",
      },
    ],
  },
};

export default nextConfig;