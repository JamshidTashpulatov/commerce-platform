/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Open Graph route reads Inter from disk; make sure the serverless bundle carries it.
  outputFileTracingIncludes: { "/og": ["./assets/fonts/**"] },
};

export default nextConfig;
