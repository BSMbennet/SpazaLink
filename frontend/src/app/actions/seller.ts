'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { uploadR2Object } from '@/lib/r2';

function message(path: string, value: string): never {
  redirect(`${path}?message=${encodeURIComponent(value)}`);
}

function isImageFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0;
}

async function uploadSellerImage(
  userId: string,
  file: File,
  folder: 'shops' | 'products',
): Promise<string | null> {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensions[file.type];
  if (!extension || file.size > 2 * 1024 * 1024) return null;
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
  try {
    await uploadR2Object(path, file);
    return path;
  } catch {
    return null;
  }
}

async function sellerContext() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'seller') redirect('/dashboard?message=Seller%20access%20has%20not%20been%20approved%20yet.');

  const { data: shop, error } = await supabase.from('shops')
    .select('id,owner_id,status,name,description,phone,address_text,area,offers_collection,offers_delivery,delivery_fee,photo_path')
    .eq('owner_id', userId).maybeSingle();
  if (error) message('/dashboard', 'Could not load your shop. Please try again.');
  return { supabase, userId, shop };
}

export async function saveShop(formData: FormData) {
  const { supabase, userId, shop } = await sellerContext();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const addressText = String(formData.get('addressText') ?? '').trim();
  const area = String(formData.get('area') ?? '').trim();
  const offersCollection = formData.get('offersCollection') === 'on';
  const offersDelivery = formData.get('offersDelivery') === 'on';
  const rawFee = String(formData.get('deliveryFee') ?? '0').trim();
  const deliveryFee = Number(rawFee);
  const photoValue = formData.get('shopPhoto');
  const photoFile = isImageFile(photoValue) ? photoValue : null;

  if (name.length < 2 || name.length > 100 || addressText.length < 4 || addressText.length > 200 || area.length < 2 || area.length > 80) {
    message('/seller/shop', 'Enter a shop name, street or collection address, and area within the indicated limits.');
  }
  if (description.length > 500 || phone.length > 30 || !Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 99999) {
    message('/seller/shop', 'Check the description, phone number and delivery fee.');
  }
  if (!offersCollection && !offersDelivery) message('/seller/shop', 'Choose at least one fulfilment option.');
  if (photoFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type) || photoFile.size > 2 * 1024 * 1024)) {
    message('/seller/shop', 'Shop photos must be JPG, PNG or WebP and no larger than 2 MB.');
  }

  const hours = Array.from({ length: 7 }, (_, weekday) => {
    const isClosed = formData.get(`hours_${weekday}_closed`) === 'on';
    const opensAt = String(formData.get(`hours_${weekday}_open`) ?? '').trim();
    const closesAt = String(formData.get(`hours_${weekday}_close`) ?? '').trim();
    if (!isClosed && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(opensAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(closesAt) || opensAt === closesAt)) {
      message('/seller/shop', 'Enter valid opening and closing times for each open day, or mark the day closed.');
    }
    return { weekday, opens_at: isClosed ? null : opensAt, closes_at: isClosed ? null : closesAt, is_closed: isClosed };
  });

  const values = {
    name, description: description || null, phone: phone || null, address_text: addressText, area,
    offers_collection: offersCollection, offers_delivery: offersDelivery,
    delivery_fee: offersDelivery ? deliveryFee : 0,
  };
  const result = shop
    ? await supabase.from('shops').update(values).eq('id', shop.id).eq('owner_id', userId).select('id').maybeSingle()
    : await supabase.from('shops').insert({ ...values, owner_id: userId }).select('id').single();

  if (result.error || !result.data) message('/seller/shop', 'Your shop could not be saved. Check your seller approval and try again.');
  const shopId = result.data.id;
  const { error: hoursError } = await supabase.from('shop_hours').upsert(
    hours.map(hour => ({ ...hour, shop_id: shopId })),
    { onConflict: 'shop_id,weekday' },
  );
  if (hoursError) message('/seller/shop', 'Shop details were saved, but opening hours could not be updated. Please retry.');

  if (photoFile) {
    const photoPath = await uploadSellerImage(userId, photoFile, 'shops');
    if (!photoPath) message('/seller/shop', 'Photo upload failed. Use a JPG, PNG or WebP image smaller than 2 MB.');
    const { error: photoError } = await supabase.from('shops').update({ photo_path: photoPath }).eq('id', shopId).eq('owner_id', userId);
    if (photoError) message('/seller/shop', 'Shop details were saved, but the shop photo could not be attached.');
  }
  message('/seller/shop', 'Shop details saved. Your shop remains pending until it is reviewed.');
}

export async function addProduct(formData: FormData) {
  const { supabase, userId, shop } = await sellerContext();
  if (!shop) redirect('/seller/shop?message=Create%20your%20shop%20before%20adding%20products.');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const rawPrice = String(formData.get('price') ?? '').trim();
  const rawStock = String(formData.get('stockQuantity') ?? '').trim();
  const rawCategory = String(formData.get('categoryId') ?? '').trim();
  const price = Number(rawPrice);
  const stockQuantity = Number(rawStock);
  const categoryId = rawCategory || null;
  const photoValue = formData.get('productPhoto');
  const photoFile = isImageFile(photoValue) ? photoValue : null;

  if (name.length < 2 || name.length > 120 || description.length > 500 ||
      rawPrice === '' || !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
      rawStock === '' || !Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000 ||
      (categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId))) {
    message('/seller/products', 'Check the product name, description, price, stock quantity and category.');
  }
  if (photoFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type) || photoFile.size > 2 * 1024 * 1024)) {
    message('/seller/products', 'Product photos must be JPG, PNG or WebP and no larger than 2 MB.');
  }

  const photoPath = photoFile ? await uploadSellerImage(userId, photoFile, 'products') : null;
  if (photoFile && !photoPath) message('/seller/products', 'Photo upload failed. Use a JPG, PNG or WebP image smaller than 2 MB.');
  const { error } = await supabase.from('products').insert({
    shop_id: shop.id, name, description: description || null, price,
    stock_quantity: stockQuantity, category_id: categoryId, photo_path: photoPath,
  });
  if (error) message('/seller/products', 'The product could not be saved. Please try again.');
  message('/seller/products', 'Product added to your catalogue.');
}

export async function updateProduct(formData: FormData) {
  const { supabase, userId, shop } = await sellerContext();
  if (!shop) redirect('/seller/shop');
  const productId = String(formData.get('productId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const rawPrice = String(formData.get('price') ?? '').trim();
  const rawStock = String(formData.get('stockQuantity') ?? '').trim();
  const rawCategory = String(formData.get('categoryId') ?? '').trim();
  const price = Number(rawPrice);
  const stockQuantity = Number(rawStock);
  const categoryId = rawCategory || null;
  const photoValue = formData.get('productPhoto');
  const photoFile = isImageFile(photoValue) ? photoValue : null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId) ||
      name.length < 2 || name.length > 120 || description.length > 500 ||
      rawPrice === '' || !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
      rawStock === '' || !Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000 ||
      (categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId))) {
    message('/seller/products', 'Check the product details, price, stock quantity and category.');
  }
  if (photoFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type) || photoFile.size > 2 * 1024 * 1024)) {
    message('/seller/products', 'Product photos must be JPG, PNG or WebP and no larger than 2 MB.');
  }
  const updates: { name: string; description: string | null; price: number; stock_quantity: number; category_id: string | null; photo_path?: string } = {
    name, description: description || null, price, stock_quantity: stockQuantity, category_id: categoryId,
  };
  if (photoFile) {
    const photoPath = await uploadSellerImage(supabase, userId, photoFile, 'products');
    if (!photoPath) message('/seller/products', 'Photo upload failed. Use a JPG, PNG or WebP image smaller than 2 MB.');
    updates.photo_path = photoPath;
  }
  const { error } = await supabase.from('products').update(updates).eq('id', productId).eq('shop_id', shop.id);
  if (error) message('/seller/products', 'The product details could not be updated.');
  message('/seller/products', 'Product details updated.');
}

export async function setProductActive(formData: FormData) {
  const { supabase, shop } = await sellerContext();
  if (!shop) redirect('/seller/shop');
  const productId = String(formData.get('productId') ?? '');
  const active = formData.get('active') === 'true';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    message('/seller/products', 'Invalid product.');
  }
  const { error } = await supabase.from('products').update({ is_active: active })
    .eq('id', productId).eq('shop_id', shop.id);
  if (error) message('/seller/products', 'Product availability could not be updated.');
  message('/seller/products', active ? 'Product is now listed.' : 'Product has been hidden from the marketplace.');
}

export async function deleteProduct(formData: FormData) {
  const { supabase, shop } = await sellerContext();
  if (!shop) redirect('/seller/shop');
  const productId = String(formData.get('productId') ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    message('/seller/products', 'Invalid product.');
  }
  const { error } = await supabase.from('products').delete().eq('id', productId).eq('shop_id', shop.id);
  if (error) message('/seller/products', 'Product could not be removed.');
  message('/seller/products', 'Product removed from your catalogue.');
}
