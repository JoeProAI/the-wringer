/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/mecha/start": ["./vendor/mecha.tar.gz.b64"],
    },
  },
};
export default nextConfig;
