-- Rollback of 0002_seed_items.

BEGIN;

DELETE FROM items WHERE slug IN (
    'gift_flower', 'gift_letter', 'gift_shell', 'gift_cake',
    'furn_bed', 'furn_table', 'furn_chair', 'furn_rug', 'furn_plant', 'furn_lamp',
    'res_wood', 'res_stone', 'res_flower'
);

COMMIT;
