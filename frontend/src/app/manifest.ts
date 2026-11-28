import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'SpazaLink', short_name: 'SpazaLink', description: 'Your neighbourhood marketplace in South Africa.', start_url: '/', display: 'standalone', background_color: '#0b1424', theme_color: '#0b1424', icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}
