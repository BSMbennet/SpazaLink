create index if not exists shops_reviewed_by_idx on public.shops(reviewed_by);
create index if not exists shops_verified_by_idx on public.shops(verified_by);
create index if not exists seller_verification_documents_reviewed_by_idx on public.seller_verification_documents(reviewed_by);
