/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les packages du monorepo sont en TS brut -> Next doit les transpiler
  transpilePackages: ['@xo/shared', '@xo/db'],
};

export default nextConfig;
