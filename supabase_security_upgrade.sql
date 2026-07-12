-- 1. Restrict Products (Keep public SELECT so customers can see them)
DROP POLICY IF EXISTS "Allow public to insert products" ON public.products;
DROP POLICY IF EXISTS "Allow public to update products" ON public.products;
DROP POLICY IF EXISTS "Allow public to delete products" ON public.products;

CREATE POLICY "Allow auth to insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth to update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow auth to delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- 2. Restrict Orders (Keep public INSERT so customers can checkout)
DROP POLICY IF EXISTS "Allow public to select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public to update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public to delete orders" ON public.orders;

CREATE POLICY "Allow auth to select orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth to update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow auth to delete orders" ON public.orders FOR DELETE TO authenticated USING (true);

-- 3. Restrict Order Items (Keep public INSERT so checkout works)
DROP POLICY IF EXISTS "Allow public to select order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public to update order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public to delete order items" ON public.order_items;

CREATE POLICY "Allow auth to select order items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth to update order items" ON public.order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow auth to delete order items" ON public.order_items FOR DELETE TO authenticated USING (true);
