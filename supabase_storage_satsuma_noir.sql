insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  ),
  (
    'site-images',
    'site-images',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
