-- ==========================================
-- M&H CLOTHING STORE - SUPABASE SCHEMA SETUP
-- ==========================================
-- Copy and run this script in your Supabase SQL Editor (https://supabase.com)
-- to automatically provision all tables, enable Row-Level Security,
-- set up access policies, and seed all initial products!

-- ------------------------------------------
-- 1. Create Products Table
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id INT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    original_price NUMERIC(10, 2) DEFAULT NULL,
    description TEXT,
    image TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    colors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------
-- 2. Create Orders Table
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_area TEXT NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Shipped', 'Completed', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------
-- 3. Create Order Items Table
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id INT NOT NULL,
    product_name TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL, -- Unit price at purchase
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------
-- 4. Enable Row Level Security (RLS)
-- ------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- 5. Define Access Control Policies (Security)
-- ------------------------------------------

-- Products: Everyone can view, but only authenticated admins/services can edit
DROP POLICY IF EXISTS "Allow public read-only access to products" ON public.products;
CREATE POLICY "Allow public read-only access to products" 
ON public.products 
FOR SELECT 
USING (true);

-- Orders: Anyone can submit an order (Insert), select, update or delete them (since the dashboard runs client-side with an admin passcode)
DROP POLICY IF EXISTS "Allow public to insert orders" ON public.orders;
CREATE POLICY "Allow public to insert orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public to select orders" ON public.orders;
CREATE POLICY "Allow public to select orders" 
ON public.orders 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow public to update orders" ON public.orders;
CREATE POLICY "Allow public to update orders" 
ON public.orders 
FOR UPDATE 
USING (true);

DROP POLICY IF EXISTS "Allow public to delete orders" ON public.orders;
CREATE POLICY "Allow public to delete orders" 
ON public.orders 
FOR DELETE 
USING (true);

-- Order Items: Anyone can submit items for an order, select, update, or delete them
DROP POLICY IF EXISTS "Allow public to insert order items" ON public.order_items;
CREATE POLICY "Allow public to insert order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public to select order items" ON public.order_items;
CREATE POLICY "Allow public to select order items" 
ON public.order_items 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow public to update order items" ON public.order_items;
CREATE POLICY "Allow public to update order items" 
ON public.order_items 
FOR UPDATE 
USING (true);

DROP POLICY IF EXISTS "Allow public to delete order items" ON public.order_items;
CREATE POLICY "Allow public to delete order items" 
ON public.order_items 
FOR DELETE 
USING (true);

-- ------------------------------------------
-- 6. Seed Initial Product Catalog (17 Products)
-- ------------------------------------------
INSERT INTO public.products (id, name, category, price, original_price, description, image, images, colors)
VALUES
(
  101, 
  'Premium Cotton Tee', 
  'T-Shirts', 
  35.00, 
  NULL, 
  'The ultimate white tee. Crafted from heavy 240gsm organic cotton for a structured drape that holds its shape. Available in White, Off-White, and Cream.', 
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop',
  '["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1581655353564-df123a1eb820?q=80&w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1562157873-818bc0726f68?q=80&w=800&auto=format&fit=crop"]'::jsonb,
  '[{"name": "White", "hex": "#FFFFFF", "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop"}, {"name": "Black", "hex": "#000000", "image": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800&auto=format&fit=crop"}, {"name": "Cream", "hex": "#F5F5DC", "image": "https://images.unsplash.com/photo-1562157873-818bc0726f68?q=80&w=800&auto=format&fit=crop"}]'::jsonb
),
(
  102, 
  'Heavyweight Boxy Tee', 
  'T-Shirts', 
  45.00, 
  55.00, 
  'A relaxed, drop-shoulder fit in jet black. Pre-shrunk and garment dyed for a soft, worn-in feel.', 
  'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800&auto=format&fit=crop',
  '["https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=800&auto=format&fit=crop"]'::jsonb,
  '[{"name": "Black", "hex": "#1a1a1a", "image": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800&auto=format&fit=crop"}, {"name": "Charcoal", "hex": "#36454F", "image": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=800&auto=format&fit=crop"}]'::jsonb
),
(
  103, 
  'Vintage Wash Graphic Tee', 
  'T-Shirts', 
  40.00, 
  NULL, 
  'Inspired by 90s band merch, this tee features a cracked ink print and a subtle acid wash finish.', 
  'https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=800&auto=format&fit=crop',
  '["https://images.unsplash.com/photo-1503342394128-c104d54dba01?q=80&w=800&auto=format&fit=crop"]'::jsonb,
  '[]'::jsonb
),
(
  104, 
  'Striped Sailor Long Sleeve', 
  'T-Shirts', 
  48.00, 
  NULL, 
  'Classic Breton stripes on soft jersey cotton. A versatile layering piece for transitional weather.', 
  'https://images.unsplash.com/photo-1503342394128-c104d54dba01?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  201, 
  'Distressed Blue Denim', 
  'Pants', 
  45.00, 
  NULL, 
  'Classic blue jeans featuring a relaxed fit and subtle distressed detailing on the knee.', 
  'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  202, 
  'Dark Wash Mom Jeans', 
  'Pants', 
  50.00, 
  NULL, 
  'High-waisted dark blue denim with a tapered leg for a flattering vintage silhouette.', 
  'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  203, 
  'Light Wash Straight Leg', 
  'Pants', 
  48.00, 
  NULL, 
  'Essential light blue jeans with a comfortable straight leg cut. Perfect for everyday wear.', 
  'https://images.unsplash.com/photo-1582562124811-c09040d0a901?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  204, 
  'Acid Wash Vintage Jeans', 
  'Pants', 
  55.00, 
  NULL, 
  'Statement acid wash denim with a retro 80s inspired look and relaxed fit.', 
  'https://images.unsplash.com/photo-1604176354204-9268737828e4?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  205, 
  'Olive Green Chinos', 
  'Pants', 
  42.00, 
  NULL, 
  'Versatile olive green trousers made from soft cotton twill. A great alternative to denim.', 
  'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  206, 
  'Grey Stone Wash Jeans', 
  'Pants', 
  52.00, 
  NULL, 
  'Edgy grey stone wash denim with a slim-straight fit. Adds texture to any outfit.', 
  'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  301, 
  'Oversized Wool Blazer', 
  'Jackets', 
  250.00, 
  NULL, 
  'Structured yet slouchy, this wool-blend blazer adds instant polish. Features padded shoulders and deep pockets.', 
  'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[{"name": "Grey", "hex": "#808080", "image": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop"}]'::jsonb
),
(
  302, 
  'Classic Denim Jacket', 
  'Jackets', 
  140.00, 
  NULL, 
  'The timeless trucker jacket in a medium vintage wash. Durable, rugged, and gets better with age.', 
  'https://images.unsplash.com/photo-1523205565295-f8e91625443b?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  303, 
  'Suede Bomber Jacket', 
  'Jackets', 
  320.00, 
  NULL, 
  'Luxurious genuine suede in a rich tan hue. Finished with ribbed cuffs and silver hardware.', 
  'https://images.unsplash.com/photo-1559551409-dadc959f76b8?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  304, 
  'Technical Shell Coat', 
  'Jackets', 
  180.00, 
  220.00, 
  'A lightweight, waterproof parka shell designed for layering. Features a storm hood and sealed seams.', 
  'https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  401, 
  'Minimalist Leather Sneaker', 
  'Shoes', 
  150.00, 
  NULL, 
  'Handcrafted from full-grain white leather with a durable rubber cupsole. Clean lines for everyday wear.', 
  'https://images.unsplash.com/photo-1560769629-975e13f0c470?q=80&w=800&auto=format&fit=crop',
  '["https://images.unsplash.com/photo-1560769629-975e13f0c470?q=80&w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?q=80&w=800&auto=format&fit=crop"]'::jsonb,
  '[]'::jsonb
),
(
  402, 
  'Chunky Penny Loafer', 
  'Shoes', 
  180.00, 
  NULL, 
  'A modern twist on a classic. Polished black leather with a substantial lug sole for added height and attitude.', 
  'https://images.unsplash.com/photo-1533867617858-e7b97e0605df?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  403, 
  'Leather Chelsea Boot', 
  'Shoes', 
  210.00, 
  NULL, 
  'Sleek ankle boots with elastic side panels and a pull tab. Made from premium Italian leather.', 
  'https://images.unsplash.com/photo-1608231387042-66d1773070a5?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
),
(
  404, 
  'Canvas High Top', 
  'Shoes', 
  85.00, 
  NULL, 
  'Vintage-inspired canvas trainers with a vulcanized rubber sole. The weekend essential.', 
  'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?q=80&w=800&auto=format&fit=crop',
  '[]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    description = EXCLUDED.description,
    image = EXCLUDED.image,
    images = EXCLUDED.images,
    colors = EXCLUDED.colors;
