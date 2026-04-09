/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run用にスタンドアロン出力を有効化（Dockerイメージを小さくする）
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pdfjs-dist, tesseract.js, xlsxのためのpolyfill/fallback
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    // canvas モジュールの除外（pdfjs-dist用）
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    return config
  },
}

module.exports = nextConfig
