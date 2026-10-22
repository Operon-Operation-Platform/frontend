const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  // GitHub Pages serves this project from its repository subpath.
  ...(isGitHubPages
    ? {
        output: 'export',
        distDir: 'out', 
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/frontend',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : { output: 'standalone' }),
  turbopack: {
    root: process.cwd(),
  },
  ...(!isGitHubPages && {
    async redirects() {
      return [
        { source: '/dashboard', destination: '/operon?tab=dashboard', permanent: false },
        { source: '/agents', destination: '/operon?tab=dashboard', permanent: false },
        { source: '/runs', destination: '/operon?tab=runs', permanent: false },
        { source: '/approvals', destination: '/operon?tab=approvals', permanent: false },
        { source: '/integrations', destination: '/operon?tab=integrations', permanent: false },
        { source: '/knowledge', destination: '/operon?tab=datasources', permanent: false },
        { source: '/datasources', destination: '/operon?tab=datasources', permanent: false },
        { source: '/tools', destination: '/operon?tab=tools_mcp', permanent: false },
      ];
    },
  }),
};

export default nextConfig;
