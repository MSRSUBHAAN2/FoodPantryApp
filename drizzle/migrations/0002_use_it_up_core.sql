CREATE TABLE public.pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  brand text,
  barcode text,
  category text NOT NULL DEFAULT 'Other',
  location text NOT NULL DEFAULT 'fridge' CHECK (location IN ('fridge','freezer','cupboard','pantry')),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'pieces',
  serving_size text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  printed_date date,
  date_type text NOT NULL DEFAULT 'none' CHECK (date_type IN ('use_by','best_before','sell_by','none')),
  opened_date date,
  open_life_days integer CHECK (open_life_days IS NULL OR open_life_days >= 0),
  open_life_source text,
  frozen_date date,
  thawed_date date,
  allergens text[],
  nutrition jsonb,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','discarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pantry_items TO authenticated;
GRANT ALL ON public.pantry_items TO service_role;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own items" ON public.pantry_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pantry_items_user_idx ON public.pantry_items(user_id, status);

CREATE TABLE public.item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  item_id uuid,
  item_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('added','opened','frozen','thawed','moved','consumed','cooked','finished','discarded','restored')),
  amount numeric,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.item_events TO authenticated;
GRANT ALL ON public.item_events TO service_role;
ALTER TABLE public.item_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own events" ON public.item_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  meal text NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snacks')),
  name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  unit text NOT NULL,
  nutrients jsonb NOT NULL DEFAULT '{}'::jsonb,
  nutrition_source text,
  nutrition_basis text,
  nutrition_complete boolean NOT NULL DEFAULT false,
  item_id uuid,
  stock_deducted numeric,
  stock_unit text,
  request_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diary_entries TO authenticated;
GRANT ALL ON public.diary_entries TO service_role;
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own diary" ON public.diary_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  quantity text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_items TO authenticated;
GRANT ALL ON public.shopping_items TO service_role;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own shopping" ON public.shopping_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  calorie_goal integer,
  dietary text NOT NULL DEFAULT 'none',
  allergies text[] NOT NULL DEFAULT '{}',
  dislikes text[] NOT NULL DEFAULT '{}',
  max_cook_minutes integer NOT NULL DEFAULT 45,
  servings integer NOT NULL DEFAULT 2,
  equipment text[] NOT NULL DEFAULT '{hob,oven}',
  reminder_days integer[] NOT NULL DEFAULT '{7,3,1}',
  overdue_alerts boolean NOT NULL DEFAULT true,
  email_reminders boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_item(
  _item_id uuid, _amount numeric, _request_id uuid, _log boolean,
  _meal text, _entry_date date, _name text, _diary_amount numeric, _diary_unit text,
  _nutrients jsonb, _source text, _basis text, _complete boolean, _kind text DEFAULT 'consumed'
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _item public.pantry_items; _existing uuid; _entry uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO _existing FROM public.diary_entries WHERE request_id = _request_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  IF EXISTS (SELECT 1 FROM public.item_events WHERE id = _request_id) THEN RETURN NULL; END IF;
  SELECT * INTO _item FROM public.pantry_items WHERE id = _item_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF _amount <= 0 OR _amount > _item.quantity THEN RAISE EXCEPTION 'Amount must be between 0 and %', _item.quantity; END IF;
  UPDATE public.pantry_items SET quantity = quantity - _amount,
    status = CASE WHEN quantity - _amount <= 0 THEN 'finished' ELSE status END, updated_at = now()
    WHERE id = _item_id;
  INSERT INTO public.item_events(id, item_id, item_name, kind, amount, unit)
    VALUES (_request_id, _item_id, _item.name, CASE WHEN _kind = 'cooked' THEN 'cooked' ELSE 'consumed' END, _amount, _item.unit);
  IF _item.quantity - _amount <= 0 THEN
    INSERT INTO public.item_events(item_id, item_name, kind) VALUES (_item_id, _item.name, 'finished');
  END IF;
  IF _log THEN
    INSERT INTO public.diary_entries(entry_date, meal, name, amount, unit, nutrients, nutrition_source, nutrition_basis, nutrition_complete, item_id, stock_deducted, stock_unit, request_id)
      VALUES (_entry_date, _meal, _name, _diary_amount, _diary_unit, COALESCE(_nutrients,'{}'::jsonb), _source, _basis, _complete, _item_id, _amount, _item.unit, _request_id)
      RETURNING id INTO _entry;
  END IF;
  RETURN _entry;
END $$;

CREATE OR REPLACE FUNCTION public.delete_diary_entry(_entry_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _e public.diary_entries;
BEGIN
  SELECT * INTO _e FROM public.diary_entries WHERE id = _entry_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF _e.item_id IS NOT NULL AND _e.stock_deducted IS NOT NULL THEN
    UPDATE public.pantry_items SET quantity = quantity + _e.stock_deducted,
      status = CASE WHEN status = 'finished' THEN 'active' ELSE status END, updated_at = now()
      WHERE id = _e.item_id AND user_id = auth.uid();
    DELETE FROM public.item_events WHERE id = _e.request_id;
    IF FOUND THEN NULL; END IF;
  END IF;
  DELETE FROM public.diary_entries WHERE id = _entry_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_diary_amount(_entry_id uuid, _new_amount numeric, _new_stock numeric, _nutrients jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _e public.diary_entries; _delta numeric; _q numeric;
BEGIN
  SELECT * INTO _e FROM public.diary_entries WHERE id = _entry_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF _new_amount <= 0 THEN RAISE EXCEPTION 'Amount must be above 0'; END IF;
  IF _e.item_id IS NOT NULL AND _e.stock_deducted IS NOT NULL AND _new_stock IS NOT NULL THEN
    _delta := _new_stock - _e.stock_deducted;
    SELECT quantity INTO _q FROM public.pantry_items WHERE id = _e.item_id AND user_id = auth.uid() FOR UPDATE;
    IF _q IS NOT NULL THEN
      IF _delta > _q THEN RAISE EXCEPTION 'Not enough left in stock'; END IF;
      UPDATE public.pantry_items SET quantity = quantity - _delta,
        status = CASE WHEN quantity - _delta <= 0 THEN 'finished' WHEN status = 'finished' THEN 'active' ELSE status END, updated_at = now()
        WHERE id = _e.item_id;
      UPDATE public.item_events SET amount = _new_stock WHERE id = _e.request_id;
    END IF;
    UPDATE public.diary_entries SET stock_deducted = _new_stock WHERE id = _entry_id;
  END IF;
  UPDATE public.diary_entries SET amount = _new_amount, nutrients = COALESCE(_nutrients, nutrients) WHERE id = _entry_id;
END $$;

GRANT EXECUTE ON FUNCTION public.consume_item(uuid, numeric, uuid, boolean, text, date, text, numeric, text, jsonb, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_diary_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_diary_amount(uuid, numeric, numeric, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_item(uuid, numeric, uuid, boolean, text, date, text, numeric, text, jsonb, text, text, boolean, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_diary_entry(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_diary_amount(uuid, numeric, numeric, jsonb) FROM anon, public;