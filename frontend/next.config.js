/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone — обязателен для frontend/Dockerfile (копирует .next/standalone)
  output: 'standalone',
  images: {
    domains: ['bidflow.ru', 'localhost'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  },
}

module.exports = nextConfig