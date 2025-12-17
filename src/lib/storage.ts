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
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading loops:", err);
    return [];
  }
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
const loopSubscribers = new Set();

export function subscribe(callback) {
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

export function getSettings(): { mileageRate: number } {
  const data = localStorage.getItem("settings");
  if (!data) {
    // default settings if none exist
    return { mileageRate: 0.67 };
  }
  return JSON.parse(data);
}

export function saveSettings(settings: { mileageRate: number }) {
  localStorage.setItem("settings", JSON.stringify(settings));
}
