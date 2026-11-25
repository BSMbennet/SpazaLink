'use client';

import { deleteProduct } from '@/app/actions/seller';

export function DeleteProductButton({ productId }: { productId: string }) {
  return (
    <form action={deleteProduct}>
      <input type="hidden" name="productId" value={productId}/>
      <button className="button button-danger" type="submit" onClick={(event) => {
        if (!window.confirm('Remove this product from your catalogue?')) event.preventDefault();
      }}>Remove product</button>
    </form>
  );
}
