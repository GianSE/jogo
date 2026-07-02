-- Minimal item catalog for the MVP. asset_key is a logical key resolved by the
-- frontend to a local static asset now (and to object storage later).

BEGIN;

INSERT INTO items (slug, name, category, asset_key) VALUES
    -- gifts
    ('gift_flower',     'Flor',          'gift',      'gifts/flower'),
    ('gift_letter',     'Cartinha',      'gift',      'gifts/letter'),
    ('gift_shell',      'Concha',        'gift',      'gifts/shell'),
    ('gift_cake',       'Bolinho',       'gift',      'gifts/cake'),
    -- furniture
    ('furn_bed',        'Cama',          'furniture', 'furniture/bed'),
    ('furn_table',      'Mesa',          'furniture', 'furniture/table'),
    ('furn_chair',      'Cadeira',       'furniture', 'furniture/chair'),
    ('furn_rug',        'Tapete',        'furniture', 'furniture/rug'),
    ('furn_plant',      'Plantinha',     'furniture', 'furniture/plant'),
    ('furn_lamp',       'Luminária',     'furniture', 'furniture/lamp'),
    -- resources
    ('res_wood',        'Madeira',       'resource',  'resources/wood'),
    ('res_stone',       'Pedra',         'resource',  'resources/stone'),
    ('res_flower',      'Florzinha',     'resource',  'resources/flower')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
