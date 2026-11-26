import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { optimiseImage } from '../src/lib/image-optimise.ts';

const sellerActions = readFileSync(new URL('../src/app/actions/seller.ts', import.meta.url), 'utf8');

async function phonePhoto() {
  // A big photo with hidden camera and location-style details, like a real phone photo.
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#3a7d5c' } })
    .jpeg({ quality: 95 })
    .withMetadata({ exif: { IFD0: { ImageDescription: 'taken at 12 Example Street' } } })
    .toBuffer();
}

test('optimised photos are small, WebP and fit inside 960 pixels', async () => {
  const input = await phonePhoto();
  const output = await optimiseImage(input);
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, 'webp');
  assert.ok(Math.max(meta.width, meta.height) <= 960);
  assert.ok(output.length < input.length);
});

test('optimised photos carry no hidden metadata such as location or description', async () => {
  const input = await phonePhoto();
  assert.ok((await sharp(input).metadata()).exif, 'test photo should start with metadata');
  const output = await optimiseImage(input);
  const meta = await sharp(output).metadata();
  assert.equal(meta.exif, undefined);
  assert.ok(!output.toString('latin1').includes('Example Street'));
});

test('small photos are not enlarged', async () => {
  const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#fff' } }).png().toBuffer();
  const meta = await sharp(await optimiseImage(small)).metadata();
  assert.equal(meta.width, 300);
});

test('files that are not real images are refused', async () => {
  await assert.rejects(() => optimiseImage(Buffer.from('<script>alert(1)</script>')));
});

test('seller uploads use the optimiser and store .webp names', () => {
  assert.ok(sellerActions.includes('optimiseImage: true'));
  assert.ok(sellerActions.includes('.webp'));
});
