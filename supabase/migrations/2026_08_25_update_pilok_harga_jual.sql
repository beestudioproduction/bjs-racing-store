-- Update harga_jual = harga_coret and clear harga_coret for all Pilok products
UPDATE public.products
SET harga_jual = harga_coret,
    harga_coret = NULL
WHERE kategori = 'Pilok'
  AND harga_coret IS NOT NULL;
