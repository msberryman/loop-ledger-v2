// src/lib/storage.ts
import { supabase } from "./supabase";

type Subscriber = () => void;
const subs = new Set<Subscriber>();

function notify() {
  subs.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

export function subscribe(fn: Subscriber) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// ----- In-memory caches (source of truth is Supabase) -----
let loopsCache: any[] = [];
let expensesCache: any[] = [];
let settingsCache: any = null;

// Expose sync getters for UI that still reads synchronously
export function getLoops() {
  return loopsCache;
}
export function getExpenses() {
  return expensesCache;
}
export function getSettings() {
  return settingsCache;
}

// ----- Helpers -----
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

// DB row -> app object (camelCase)
function loopFromDb(r: any) {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    course: r.course,
    placeId: r.course_place_id ?? "", // keep compatible with your existing form usage
    loopType: r.loop_type ?? "",

    bagFee: Number(r.bag_fee) || 0,
    cashTip: Number(r.cash_tip) || 0,
    digitalTip: Number(r.digital_tip) || 0,
    preGrat: Number(r.pre_grat) || 0,

    mileage_miles: Number(r.mileage_miles) || 0,
    mileage_cost: Number(r.mileage_cost) || 0,

    reportTime: r.report_time ?? "",
    teeTime: r.tee_time ?? "",
    endTime: r.end_time ?? "",

    notes: r.notes ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// app object -> DB row (snake_case)
function loopToDb(userId: string, loop: any) {
  return {
    id: loop.id, // undefined is fine for insert
    user_id: userId,

    date: loop.date,
    course: loop.course,
    course_place_id: loop.placeId || null,
    loop_type: loop.loopType || null,

    bag_fee: Number(loop.bagFee) || 0,
    cash_tip: Number(loop.cashTip) || 0,
    digital_tip: Number(loop.digitalTip) || 0,
    pre_grat: Number(loop.preGrat) || 0,

    mileage_miles: Number(loop.mileage_miles ?? loop.mileageMiles) || 0,
    mileage_cost: Number(loop.mileage_cost ?? loop.mileageCost) || 0,

    report_time: loop.reportTime || null,
    tee_time: loop.teeTime || null,
    end_time: loop.endTime || null,

    notes: loop.notes || null,
    updated_at: new Date().toISOString(),
  };
}

function expenseFromDb(r: any) {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    category: r.category,
    amount: Number(r.amount) || 0,
    notes: r.notes ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function expenseToDb(userId: string, e: any) {
  return {
    id: e.id,
    user_id: userId,
    date: e.date,
    category: e.category,
    amount: Number(e.amount) || 0,
    notes: e.notes || null,
    updated_at: new Date().toISOString(),
  };
}

function settingsFromDb(r: any) {
  return {
    userId: r.user_id,
    homeAddress: r.home_address ?? "",
    homePlaceId: r.home_place_id ?? "",
    mileageRate: Number(r.mileage_rate) || 0.67,

    // NEW: default bag fees
    defaultBagFeeSingle:
      r.default_bag_fee_single === null || r.default_bag_fee_single === undefined
        ? null
        : Number(r.default_bag_fee_single),
    defaultBagFeeDouble:
      r.default_bag_fee_double === null || r.default_bag_fee_double === undefined
        ? null
        : Number(r.default_bag_fee_double),
    defaultBagFeeForecaddie:
      r.default_bag_fee_forecaddie === null || r.default_bag_fee_forecaddie === undefined
        ? null
        : Number(r.default_bag_fee_forecaddie),

    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function settingsToDb(userId: string, s: any) {
  return {
    user_id: userId,
    home_address: s?.homeAddress || null,
    home_place_id: s?.homePlaceId || null,
    mileage_rate: Number(s?.mileageRate) || 0.67,

    // NEW: default bag fees (nullable)
    default_bag_fee_single:
      s?.defaultBagFeeSingle === null || s?.defaultBagFeeSingle === undefined || s?.defaultBagFeeSingle === ""
        ? null
        : Number(s.defaultBagFeeSingle),
    default_bag_fee_double:
      s?.defaultBagFeeDouble === null || s?.defaultBagFeeDouble === undefined || s?.defaultBagFeeDouble === ""
        ? null
        : Number(s.defaultBagFeeDouble),
    default_bag_fee_forecaddie:
      s?.defaultBagFeeForecaddie === null || s?.defaultBagFeeForecaddie === undefined || s?.defaultBagFeeForecaddie === ""
        ? null
        : Number(s.defaultBagFeeForecaddie),

    updated_at: new Date().toISOString(),
  };
}

// ----- Refresh (load from Supabase into caches) -----
export async function refreshAll() {
  const userId = await requireUserId();

  // settings
  const { data: sRow, error: sErr } = await supabase
    .from("ll_user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (sErr) throw sErr;
  settingsCache = sRow ? settingsFromDb(sRow) : null;

  // loops
  const { data: lRows, error: lErr } = await supabase
    .from("ll_loops")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (lErr) throw lErr;
  loopsCache = (lRows || []).map(loopFromDb);

  // expenses
  const { data: eRows, error: eErr } = await supabase
    .from("ll_expenses")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (eErr) throw eErr;
  expensesCache = (eRows || []).map(expenseFromDb);

  notify();
}

// ----- CRUD: Loops -----
export async function saveLoop(loop: any) {
  const userId = await requireUserId();
  const payload = loopToDb(userId, loop);

  const { data, error } = await supabase
    .from("ll_loops")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;

  // Update cache entry
  const saved = loopFromDb(data);
  loopsCache = [saved, ...loopsCache.filter((l) => l.id !== saved.id)];
  notify();
  return saved;
}

export async function deleteLoop(loopId: string) {
  const userId = await requireUserId();

  const { error } = await supabase
    .from("ll_loops")
    .delete()
    .eq("id", loopId)
    .eq("user_id", userId);

  if (error) throw error;

  loopsCache = loopsCache.filter((l) => l.id !== loopId);
  notify();
}

// For mileage update after compute
export async function updateLoopMileage(loopId: string, miles: number, cost: number) {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("ll_loops")
    .update({
      mileage_miles: Number(miles) || 0,
      mileage_cost: Number(cost) || 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loopId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;

  const updated = loopFromDb(data);
  loopsCache = [updated, ...loopsCache.filter((l) => l.id !== updated.id)];
  notify();
  return updated;
}

// ----- CRUD: Expenses -----
export async function saveExpense(expense: any) {
  const userId = await requireUserId();
  const payload = expenseToDb(userId, expense);

  const { data, error } = await supabase
    .from("ll_expenses")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;

  const saved = expenseFromDb(data);
  expensesCache = [saved, ...expensesCache.filter((e) => e.id !== saved.id)];
  notify();
  return saved;
}

export async function deleteExpense(expenseId: string) {
  const userId = await requireUserId();

  const { error } = await supabase
    .from("ll_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", userId);

  if (error) throw error;

  expensesCache = expensesCache.filter((e) => e.id !== expenseId);
  notify();
}

// ----- CRUD: Settings -----
export async function saveSettings(settings: any) {
  const userId = await requireUserId();
  const payload = settingsToDb(userId, settings);

  const { data, error } = await supabase
    .from("ll_user_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;

  settingsCache = settingsFromDb(data);
  notify();
  return settingsCache;
}

