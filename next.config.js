const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development', // Sadece Vercel'de (canlıda) çalışsın, kod yazarken bizi yavaşlatmasın
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Eski ayarların varsa buraya gelir, yoksa boş kalabilir
};

module.exports = withPWA(nextConfig);
