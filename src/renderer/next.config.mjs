/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  assetPrefix: './',
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
