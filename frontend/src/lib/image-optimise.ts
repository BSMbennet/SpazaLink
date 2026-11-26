import sharp from 'sharp';

/**
 * Makes a shop or product photo small and private:
 * - fits inside 960 x 960 and saves as WebP, so a 2 MB phone photo becomes roughly 50 to 150 KB (good for low data)
 * - applies the camera rotation, then drops all metadata, including GPS location and camera details
 * - re-encodes the pixels, so anything hidden in the original file is not kept
 */
export async function optimiseImage(input: Buffer, maxSide = 960): Promise<Buffer> {
  return sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 74 })
    .toBuffer();
}
