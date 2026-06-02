-- ─── Production Seed Data ─────────────────────────────────────────────
-- Run after migrations are applied and admin user exists.
-- Usage: wrangler d1 execute shelf-scanner-db --remote --file=scripts/seed-prod.sql
-- ───────────────────────────────────────────────────────────────────────

-- 1. Add admin as member of the store organization
INSERT OR IGNORE INTO member (id, organizationId, userId, role)
SELECT 'mem-admin-' || lower(hex(randomblob(8))), 'store-001', id, 'admin'
FROM user WHERE email = 'admin@store.com';

-- 2. Update manager's store_id and add as member
UPDATE user SET store_id = 'store-001' WHERE email = 'manager@store.com';

INSERT OR IGNORE INTO member (id, organizationId, userId, role)
SELECT 'mem-mgr-' || lower(hex(randomblob(8))), 'store-001', id, 'manager'
FROM user WHERE email = 'manager@store.com';

-- 3. Seed products (50 demo products from seed.csv)
INSERT OR REPLACE INTO product (id, store_id, barcode, name, price, category)
VALUES
  ('p001', 'store-001', '5901234123457', 'Organic Milk 1L', 4.99, 'Dairy'),
  ('p002', 'store-001', '5901234123464', 'Sourdough Bread', 5.49, 'Bakery'),
  ('p003', 'store-001', '5901234123471', 'Free Range Eggs (6pk)', 3.99, 'Dairy'),
  ('p004', 'store-001', '5901234123488', 'Greek Yogurt 500g', 4.49, 'Dairy'),
  ('p005', 'store-001', '5901234123495', 'Butter Unsalted 250g', 3.29, 'Dairy'),
  ('p006', 'store-001', '5901234123501', 'Roasted Coffee Beans 250g', 14.99, 'Beverages'),
  ('p007', 'store-001', '5901234123518', 'Green Tea Bags (20pk)', 3.99, 'Beverages'),
  ('p008', 'store-001', '5901234123525', 'Orange Juice 1L', 3.49, 'Beverages'),
  ('p009', 'store-001', '5901234123532', 'Sparkling Water 6pk', 4.99, 'Beverages'),
  ('p010', 'store-001', '5901234123549', 'Pasta Penne 500g', 1.99, 'Pasta & Rice'),
  ('p011', 'store-001', '5901234123556', 'Pasta Spaghetti 500g', 1.99, 'Pasta & Rice'),
  ('p012', 'store-001', '5901234123563', 'Basmati Rice 1kg', 3.99, 'Pasta & Rice'),
  ('p013', 'store-001', '5901234123570', 'Extra Virgin Olive Oil 500ml', 12.99, 'Oils & Vinegars'),
  ('p014', 'store-001', '5901234123587', 'Sunflower Oil 1L', 2.99, 'Oils & Vinegars'),
  ('p015', 'store-001', '5901234123594', 'Balsamic Vinegar 250ml', 5.99, 'Oils & Vinegars'),
  ('p016', 'store-001', '5901234123600', 'Canned Tomatoes 400g', 1.49, 'Canned Goods'),
  ('p017', 'store-001', '5901234123617', 'Canned Tuna 150g', 2.49, 'Canned Goods'),
  ('p018', 'store-001', '5901234123624', 'Baked Beans 400g', 1.79, 'Canned Goods'),
  ('p019', 'store-001', '5901234123631', 'Chickpeas 400g', 1.49, 'Canned Goods'),
  ('p020', 'store-001', '5901234123648', 'Dark Chocolate 100g', 3.99, 'Snacks'),
  ('p021', 'store-001', '5901234123655', 'Milk Chocolate 100g', 3.49, 'Snacks'),
  ('p022', 'store-001', '5901234123662', 'Potato Chips 150g', 2.99, 'Snacks'),
  ('p023', 'store-001', '5901234123679', 'Mixed Nuts 200g', 5.99, 'Snacks'),
  ('p024', 'store-001', '5901234123686', 'Granola Bar (6pk)', 4.49, 'Snacks'),
  ('p025', 'store-001', '5901234123693', 'Whole Wheat Flour 1kg', 2.49, 'Baking'),
  ('p026', 'store-001', '5901234123709', 'White Sugar 1kg', 1.99, 'Baking'),
  ('p027', 'store-001', '5901234123716', 'Honey 500g', 6.99, 'Baking'),
  ('p028', 'store-001', '5901234123723', 'Maple Syrup 250ml', 7.99, 'Baking'),
  ('p029', 'store-001', '5901234123730', 'Vanilla Extract 30ml', 4.49, 'Baking'),
  ('p030', 'store-001', '5901234123747', 'Chicken Breast 500g', 6.99, 'Meat'),
  ('p031', 'store-001', '5901234123754', 'Ground Beef 500g', 5.99, 'Meat'),
  ('p032', 'store-001', '5901234123761', 'Smoked Salmon 200g', 8.99, 'Seafood'),
  ('p033', 'store-001', '5901234123778', 'Frozen Mixed Vegetables 1kg', 3.49, 'Frozen'),
  ('p034', 'store-001', '5901234123785', 'Frozen Pizza 400g', 4.99, 'Frozen'),
  ('p035', 'store-001', '5901234123792', 'Vanilla Ice Cream 1L', 5.49, 'Frozen'),
  ('p036', 'store-001', '5901234123808', 'Fresh Strawberries 250g', 3.99, 'Produce'),
  ('p037', 'store-001', '5901234123815', 'Bananas (bunch)', 1.49, 'Produce'),
  ('p038', 'store-001', '5901234123822', 'Avocados (2pk)', 2.99, 'Produce'),
  ('p039', 'store-001', '5901234123839', 'Baby Spinach 150g', 2.99, 'Produce'),
  ('p040', 'store-001', '5901234123846', 'Tomatoes (500g)', 2.49, 'Produce'),
  ('p041', 'store-001', '5901234123853', 'Cheddar Cheese 200g', 4.99, 'Dairy'),
  ('p042', 'store-001', '5901234123860', 'Mozzarella 200g', 3.99, 'Dairy'),
  ('p043', 'store-001', '5901234123877', 'Cream Cheese 200g', 3.49, 'Dairy'),
  ('p044', 'store-001', '5901234123884', 'Sour Cream 200ml', 2.49, 'Dairy'),
  ('p045', 'store-001', '5901234123891', 'Still Water 1.5L', 1.29, 'Beverages'),
  ('p046', 'store-001', '5901234123907', 'Cola 2L', 2.49, 'Beverages'),
  ('p047', 'store-001', '5901234123914', 'Lemonade 1L', 2.99, 'Beverages'),
  ('p048', 'store-001', '5901234123921', 'Iced Tea 1L', 2.99, 'Beverages'),
  ('p049', 'store-001', '5901234123938', 'Tomato Ketchup 500ml', 3.29, 'Condiments'),
  ('p050', 'store-001', '5901234123945', 'Mayonnaise 400ml', 3.49, 'Condiments');

-- 4. Create store branding
INSERT OR REPLACE INTO store_branding (store_id, primary_color, accent_color, display_name, contact_email, contact_phone, footer_text)
VALUES ('store-001', '#6366f1', '#10b981', 'My Store', 'store@example.com', '+1-555-0100', 'Fresh products, fair prices.');

-- 5. Create promotions (banners)
INSERT OR IGNORE INTO promotion (id, store_id, type, title, trigger_type, active, priority)
VALUES
  ('promo-b1', 'store-001', 'banner', 'Grand Opening Sale!', 'always', 1, 10),
  ('promo-b2', 'store-001', 'banner', 'Fresh Produce Weekly Specials', 'always', 1, 5);

-- 6. Create promotions (offers)
INSERT OR IGNORE INTO promotion (id, store_id, type, title, trigger_type, trigger_value, active, priority)
VALUES
  ('promo-o1', 'store-001', 'offer', 'Buy 2 Get 1 Free on Dairy', 'category', 'Dairy', 1, 8),
  ('promo-o2', 'store-001', 'offer', '20% Off All Beverages', 'category', 'Beverages', 1, 6),
  ('promo-o3', 'store-001', 'offer', 'Coffee Lovers Special - 15% Off', 'barcode', '5901234123501', 1, 7);

-- 7. Create discount items
INSERT OR IGNORE INTO discount_item (id, store_id, barcode, name, category, original_price, new_price, discount_percent, featured, priority)
VALUES
  ('disc-01', 'store-001', '5901234123457', 'Organic Milk 1L', 'Dairy', 4.99, 3.99, 20, 1, 10),
  ('disc-02', 'store-001', '5901234123464', 'Sourdough Bread', 'Bakery', 5.49, 3.99, 27, 1, 8),
  ('disc-03', 'store-001', '5901234123501', 'Roasted Coffee Beans', 'Beverages', 14.99, 11.99, 20, 1, 9),
  ('disc-04', 'store-001', '5901234123648', 'Dark Chocolate', 'Snacks', 3.99, 2.99, 25, 0, 5),
  ('disc-05', 'store-001', '5901234123570', 'Extra Virgin Olive Oil', 'Oils & Vinegars', 12.99, 9.99, 23, 0, 6);
