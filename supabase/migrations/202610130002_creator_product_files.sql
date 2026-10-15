-- File metadata lives in Postgres; the private file bytes live in Cloudflare R2.
create table public.creator_product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.creator_products(id) on delete cascade,
  object_key text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 180),
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  status text not null default 'PENDING' check (status in ('PENDING', 'READY')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger creator_product_files_updated_at
  before update on public.creator_product_files
  for each row execute function public.set_updated_at();

alter table public.creator_product_files enable row level security;
revoke all on public.creator_product_files from anon, authenticated;
grant all on public.creator_product_files to service_role;
