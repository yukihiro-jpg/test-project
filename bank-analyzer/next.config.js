/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  async headers() {
    return [
      {
        source: '/pdf.worker.min.mjs',
        headers: [{ key: 'Content-Type', value: 'application/javascript; charset=utf-8' }]
      }
    ]
  }
}

module.exports = nextConfig
