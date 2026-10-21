const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  // GitHub Pages hosts this project at /novora-frontend, while the app's
  // normal server deployment is hosted at the domain root.
  ...(isGitHubPages
    ? {
        output: 'export',
        distDir: 'out', 
        basePath: '/novora-frontend',
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
