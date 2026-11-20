import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/auth";
import type { PantryItem, UserSettings } from "@/lib/food-types";
import type { Database } from "@/integrations/supabase/types";

type ItemInsert = Database["public"]["Tables"]["pantry_items"]["Insert"];
type ItemUpdate = Database["public"]["Tables"]["pantry_items"]["Update"];

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Active and past items. Cached per account for offline reading. */
export function useItems() {
  const uid = useUserId();
  return useQuery({
    enabled: !!uid,
    queryKey: ["items", uid],
    queryFn: async () => {
      const key = `uiu-offline-${uid}`;
      const { data, error } = await supabase.from("pantry_items").select("*").order("created_at", { ascending: false });
      if (error) {
        const cached = localStorage.getItem(key);
        if (cached) return { items: JSON.parse(cached) as PantryItem[], offline: true };
        throw new Error(error.message);
      }
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* storage full */
      }
      return { items: data, offline: false };
    },
  });
}

export function useSettings() {
  const uid = useUserId();
  return useQuery({
    enabled: !!uid,
    queryKey: ["settings", uid],
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      fail(error);
      if (data) return data;
      const { data: created, error: e2 } = await supabase.from("user_settings").insert({ user_id: uid }).select().single();
      fail(e2);
      return created!;
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  const uid = useUserId();
  return useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      const { error } = await supabase.from("user_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", uid);
      fail(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export async function logEvent(item: { id: string; name: string }, kind: string, amount?: number, unit?: string) {
  await supabase.from("item_events").insert({ item_id: item.id, item_name: item.name, kind, amount: amount ?? null, unit: unit ?? null });
}

export function useAddItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ItemInsert[]) => {
      const { data, error } = await supabase.from("pantry_items").insert(rows).select();
      fail(error);
      await supabase.from("item_events").insert(data!.map((d) => ({ item_id: d.id, item_name: d.name, kind: "added", amount: d.quantity, unit: d.unit })));
      return data!;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, patch, event }: { item: PantryItem; patch: ItemUpdate; event?: string }) => {
      const { error } = await supabase.from("pantry_items").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", item.id);
      fail(error);
      if (event) await logEvent(item, event);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pantry_items").delete().eq("id", id);
      fail(error);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useEvents() {
  const uid = useUserId();
  return useQuery({
    enabled: !!uid,
    queryKey: ["events", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("item_events").select("*").order("created_at", { ascending: false }).limit(500);
      fail(error);
      return data!;
    },
  });
}

export function useDiary(date: string) {
  const uid = useUserId();
  return useQuery({
    enabled: !!uid,
    queryKey: ["diary", uid, date],
    queryFn: async () => {
      const { data, error } = await supabase.from("diary_entries").select("*").eq("entry_date", date).order("created_at");
      fail(error);
      return data!;
    },
  });
}

export function useShopping() {
  const uid = useUserId();
  return useQuery({
    enabled: !!uid,
    queryKey: ["shopping", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("shopping_items").select("*").order("done").order("created_at", { ascending: false });
      fail(error);
      return data!;
    },
  });
}
