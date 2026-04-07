/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run用にスタンドアロン出力を有効化（Dockerイメージを小さくする）
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
}

module.exports = nextConfig
