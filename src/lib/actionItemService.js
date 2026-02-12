import { base44 } from "@/api/base44Client";
import { isSupabaseEnabled, supabase } from "@/lib/supabaseClient";

const normalizeItem = (row) => ({
  id: row.id,
  title: row.title,
  workstream: row.workstream || "other",
  priority: row.priority || "medium",
  owner: row.owner || "",
  due_date: row.due_date || "",
  notes: row.notes || "",
  status: row.status || "todo",
  created_date: row.created_date || row.created_at || null,
});

export async function listActionItems() {
  if (!isSupabaseEnabled || !supabase) {
    const rows = await base44.entities.ActionItem.list("-created_date", 100);
    return rows.map(normalizeItem);
  }

  const { data, error } = await supabase
    .from("action_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []).map(normalizeItem);
}

export async function createActionItem(payload) {
  if (!isSupabaseEnabled || !supabase) {
    return base44.entities.ActionItem.create(payload);
  }

  const insertPayload = {
    title: payload.title,
    workstream: payload.workstream || "other",
    priority: payload.priority || "medium",
    owner: payload.owner || null,
    due_date: payload.due_date || null,
    notes: payload.notes || null,
    status: payload.status || "todo",
  };

  const { data, error } = await supabase
    .from("action_items")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeItem(data);
}

export async function updateActionItem(id, patch) {
  if (!isSupabaseEnabled || !supabase) {
    return base44.entities.ActionItem.update(id, patch);
  }

  const { data, error } = await supabase
    .from("action_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeItem(data);
}

