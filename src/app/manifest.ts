import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'SpazaLink', short_name: 'SpazaLink', description: 'Your neighbourhood marketplace in South Africa.', start_url: '/', display: 'standalone', background_color: '#f6f5ef', theme_color: '#155e45', icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}
