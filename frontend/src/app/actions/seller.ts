'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function message(path: string, value: string): never {
  redirect(`${path}?message=${encodeURIComponent(value)}`);
}

async function sellerContext() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'seller') redirect('/dashboard?message=Seller%20access%20has%20not%20been%20approved%20yet.');

  const { data: shop, error } = await supabase.from('shops')
    .select('id,owner_id,status,name,description,phone,address_text,area,offers_collection,offers_delivery,delivery_fee')
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

  if (name.length < 2 || name.length > 100 || addressText.length < 4 || addressText.length > 200 || area.length < 2 || area.length > 80) {
    message('/seller/shop', 'Enter a shop name, street or collection address, and area within the indicated limits.');
  }
  if (description.length > 500 || phone.length > 30 || !Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 99999) {
    message('/seller/shop', 'Check the description, phone number and delivery fee.');
  }
  if (!offersCollection && !offersDelivery) {
    message('/seller/shop', 'Choose at least one fulfilment option.');
  }

  const values = {
    name, description: description || null, phone: phone || null, address_text: addressText, area,
    offers_collection: offersCollection, offers_delivery: offersDelivery,
    delivery_fee: offersDelivery ? deliveryFee : 0,
  };
  const result = shop
    ? await supabase.from('shops').update(values).eq('id', shop.id).eq('owner_id', userId).select('id').maybeSingle()
    : await supabase.from('shops').insert({ ...values, owner_id: userId }).select('id').single();

  if (result.error || !result.data) message('/seller/shop', 'Your shop could not be saved. Check your seller approval and try again.');
  message('/seller/shop', 'Shop details saved. Your shop remains pending until it is reviewed.');
}

export async function addProduct(formData: FormData) {
  const { supabase, shop } = await sellerContext();
  if (!shop) redirect('/seller/shop?message=Create%20your%20shop%20before%20adding%20products.');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const rawPrice = String(formData.get('price') ?? '').trim();
  const rawStock = String(formData.get('stockQuantity') ?? '').trim();
  const rawCategory = String(formData.get('categoryId') ?? '').trim();
  const price = Number(rawPrice);
  const stockQuantity = Number(rawStock);
  const categoryId = rawCategory || null;

  if (name.length < 2 || name.length > 120 || description.length > 500 ||
      !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
      !Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000 ||
      (categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId))) {
    message('/seller/products', 'Check the product name, description, price, stock quantity and category.');
  }

  const { error } = await supabase.from('products').insert({
    shop_id: shop.id, name, description: description || null, price, stock_quantity: stockQuantity, category_id: categoryId,
  });
  if (error) message('/seller/products', 'The product could not be saved. Please try again.');
  message('/seller/products', 'Product added to your catalogue.');
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
