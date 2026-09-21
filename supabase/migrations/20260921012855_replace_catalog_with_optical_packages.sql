-- Replace the initial demonstration catalog with the optical packages confirmed
-- by the business. Historical quotation/order lines retain their immutable
-- snapshots; only their optional link to the mutable catalog is removed.

update public.quotation_items
set catalog_item_id = null
where catalog_item_id is not null;

update public.order_items
set catalog_item_id = null
where catalog_item_id is not null;

delete from public.catalog_item_compatibilities;
delete from public.graduation_rules;
delete from public.catalog_item_overrides;
delete from public.catalog_items;

insert into public.catalog_items (
  category,
  code,
  name,
  description,
  cost_amount,
  sale_price,
  currency
)
values
  ('vision_type', 'monofocal_blanco', 'Monofocal · Blanco', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 7000, 'CUP'),
  ('vision_type', 'monofocal_fotocromatico', 'Monofocal · Fotocromático', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 60, 'USD'),
  ('vision_type', 'monofocal_anti_blue', 'Monofocal · Anti Blue', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 50, 'USD'),
  ('vision_type', 'monofocal_foto_blue', 'Monofocal · Foto Blue', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 70, 'USD'),
  ('vision_type', 'bifocal_blanco', 'Bifocal · Blanco', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 20, 'USD'),
  ('vision_type', 'bifocal_fotocromatico', 'Bifocal · Fotocromático', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 90, 'USD'),
  ('vision_type', 'bifocal_anti_blue', 'Bifocal · Anti Blue', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 80, 'USD'),
  ('vision_type', 'bifocal_foto_blue', 'Bifocal · Foto Blue', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 100, 'USD'),
  ('vision_type', 'progresivo_blanco', 'Progresivo · Blanco', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 25, 'USD'),
  ('vision_type', 'progresivo_fotocromatico', 'Progresivo · Fotocromático', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 100, 'USD'),
  ('vision_type', 'progresivo_anti_blue', 'Progresivo · Anti Blue', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 90, 'USD'),
  ('vision_type', 'progresivo_foto_blue', 'Progresivo · Foto Blue', 'Precio base por el par de cristales. Puede aumentarse al cotizar.', 0, 120, 'USD'),
  ('frame', 'armadura_sola', 'Armadura sola', 'Precio base de la armadura. Puede aumentarse al cotizar.', 0, 3000, 'CUP');
