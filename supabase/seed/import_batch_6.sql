insert into catalog.import_variants
  (source_row_no, brand, category, collection, sub_category,
   wood, wood_colour, material_grade,
   width_cm, depth_cm, height_cm, seat_height_cm,
   legacy_nnsku, legacy_fullname,
   list_price_incl_vat, discount_pct, ontop_pct, batch_id)
select v.n::int, v.brand, v.category, v.collection, v.sub_category,
       v.wood, v.wood_colour, v.material_grade,
       v.w::numeric, v.d::numeric, v.h::numeric, v.sh::numeric,
       v.nnsku, v.fullname,
       v.price::numeric, v.disc::numeric, v.ontop::numeric,
       b.id
from (values
  (751,'ฌ เฌอ','อาร์มแชร์','อินทรี','พร้อมสตูล',null,null,'หนังแท้','90','166','83',null,'10060648','ฌ เฌอ | อาร์มแชร์ พร้อมสตูล อินทรี  (Insee Armchair+Stool)   หนังแท้เลือกสีได้ | ขนาด W90 D166 H83 cm','70300.00','30','10')
) as v(n, brand, category, collection, sub_category, wood, wood_colour, material_grade,
     w, d, h, sh, nnsku, fullname, price, disc, ontop)
cross join catalog.import_batches b
where b.source_file = 'standard-price-2026-grid-view.csv';
