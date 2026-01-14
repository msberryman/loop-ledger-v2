// src/lib/storage.ts

// ---- Internal keys ----
const LOOPS_KEY = "loops";
const EXPENSES_KEY = "expenses";

// ---- Generate new IDs ----
export function newId() {
  return crypto.randomUUID();
}

// ---- Get Loops ----
export function getLoops() {
  try {
    const raw = localStorage.getItem(LOOPS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Normalize legacy loops so old data still works
    const normalized = parsed.map(normalizeLoop);

    // Optional: write back so migration is permanent
    // (safe + prevents re-normalizing every load)
    try {
      localStorage.setItem(LOOPS_KEY, JSON.stringify(normalized));
    } catch {
      // ignore write-back failures
    }

    return normalized;
  } catch (err) {
    console.error("Error reading loops:", err);
    return [];
  }
}

function normalizeLoop(l: any) {
  const bagFee = num(l.bagFee ?? l.bag_fee) ?? 0;

  // Legacy tip model: tip + tipType ("Cash" | "Digital")
  const legacyTip = num(l.tip);
  const legacyTipType = String(l.tipType ?? l.tip_type ?? "").toLowerCase();

  const cashTip =
    num(l.cashTip ?? l.cash_tip) ??
    (legacyTip != null && legacyTipType === "cash" ? legacyTip : null) ??
    0;

  const digitalTip =
    num(l.digitalTip ?? l.digital_tip) ??
    (legacyTip != null && legacyTipType === "digital" ? legacyTip : null) ??
    0;

  // Legacy pre-grat key is "pregrat"
  const preGrat = num(l.preGrat ?? l.pre_grat ?? l.pregrat) ?? 0;

  // Mileage naming safety
  const mileage_miles = num(l.mileage_miles ?? l.mileageMiles) ?? 0;
  const mileage_cost = num(l.mileage_cost ?? l.mileageCost) ?? 0;

  return {
    ...l,
    bagFee,
    cashTip,
    digitalTip,
    preGrat,
    mileage_miles,
    mileage_cost,
  };
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---- Save Loops ----
export function saveLoops(list) {
  try {
    localStorage.setItem(LOOPS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Error saving loops:", err);
  }
}

// ---- Subscribe to loop changes ----
const loopSubscribers = new Set<() => void>();

export function subscribe(callback: () => void) {
  loopSubscribers.add(callback);
  return () => loopSubscribers.delete(callback);
}

function notify() {
  for (const cb of loopSubscribers) cb();
}


// ---- Add Loop ----
export function addLoop(loop) {
  const list = getLoops();
  list.push(loop);
  saveLoops(list);
  notify();
}

// ---- Delete Loop ----
export function deleteLoop(id) {
  const list = getLoops().filter(x => x.id !== id);
  saveLoops(list);
  notify();
}

// ---- Expenses ----

export function getExpenses() {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading expenses:", err);
    return [];
  }
}

export function saveExpenses(list) {
  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Error saving expenses:", err);
  }
}

export function addExpense(exp) {
  const list = getExpenses();
  list.push(exp);
  saveExpenses(list);
  notify();
}

export function deleteExpense(id) {
  const list = getExpenses().filter(x => x.id !== id);
  saveExpenses(list);
  notify();
}

// ---- Settings ----
export type UserSettings = {
  mileageRate: number;
  homeAddress?: string;
  homePlaceId?: string | null;
};

export function getSettings(): UserSettings {
  // NEW canonical storage (Settings.tsx uses this)
  try {
    const raw = localStorage.getItem("ll_user_settings");
    if (raw) {
      const data = JSON.parse(raw);
      return {
        mileageRate: Number(data.mileage_rate ?? 0.67),
        homeAddress: data.home_address ?? "",
        homePlaceId: data.home_place_id ?? null,
      };
    }
  } catch (err) {
    console.error("Error reading ll_user_settings:", err);
  }

  // LEGACY fallback (older builds)
  try {
    const legacy = localStorage.getItem("settings");
    if (legacy) {
      const data = JSON.parse(legacy);
      return {
        mileageRate: Number(data.mileageRate ?? 0.67),
        homeAddress: "",
        homePlaceId: null,
      };
    }
  } catch (err) {
    console.error("Error reading legacy settings:", err);
  }

  // Default
  return { mileageRate: 0.67, homeAddress: "", homePlaceId: null };
}

export function saveSettings(settings: UserSettings) {
  // Write NEW canonical format
  const payload = {
    home_address: settings.homeAddress ?? "",
    home_place_id: settings.homePlaceId ?? null,
    mileage_rate: settings.mileageRate ?? 0.67,
  };
  localStorage.setItem("ll_user_settings", JSON.stringify(payload));

  // Also write legacy (optional safety)
  localStorage.setItem(
    "settings",
    JSON.stringify({ mileageRate: settings.mileageRate ?? 0.67 })
  );

  notify();
}
