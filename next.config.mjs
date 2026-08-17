/** @type {import('next').NextConfig} */
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig = {
  devIndicators: false,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGitHubPages && repositoryName ? `/${repositoryName}` : "",
  assetPrefix: isGitHubPages && repositoryName ? `/${repositoryName}/` : "",
};

export default nextConfig;
