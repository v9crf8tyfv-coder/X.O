/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les packages du monorepo sont en TS brut -> Next doit les transpiler
  transpilePackages: ['@xo/shared', '@xo/db'],
  webpack: (config) => {
    // Les packages @xo/* importent en '.js' (style NodeNext) mais les fichiers
    // sont des '.ts' -> on dit à webpack de résoudre '.js' vers '.ts'/'.tsx'.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
