/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The /live route is an OBS video source: nothing may be painted over it,
  // not even in development.
  devIndicators: false,
};

export default nextConfig;
