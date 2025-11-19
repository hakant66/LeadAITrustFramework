/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/scorecard/:projectId", destination: "/api/scorecard/:projectId" },
    ];
  },
};

export default nextConfig;
