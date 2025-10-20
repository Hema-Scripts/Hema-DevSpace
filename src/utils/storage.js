import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const EXPENSES_KEY = 'ETP_EXPENSES_V1';
const BUDGETS_KEY = 'ETP_BUDGETS_V1';
const SETTINGS_KEY = 'ETP_SETTINGS_V1';
const RATES_KEY = 'ETP_RATES_V1';

export const DEFAULT_PROJECT = 'Default';
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];
export const DEFAULT_CATEGORIES = [
  'Income', 'Savings', 'Food', 'Transport', 'Housing', 'Entertainment', 'Utilities', 'Healthcare', 'Education', 'Shopping', 'Travel', 'Other'
];

function uuid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const defaults = {
      theme: 'light',
      email: '',
      savingsGoal: 1000,
      projects: [DEFAULT_PROJECT],
      lastRates: null,
    };
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (e) {
    return { theme: 'light', email: '', savingsGoal: 1000, projects: [DEFAULT_PROJECT], lastRates: null };
  }
}

export async function updateSettings(patch) {
  const settings = await getSettings();
  const next = { ...settings, ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function getProjects() {
  const settings = await getSettings();
  return settings.projects || [DEFAULT_PROJECT];
}

export async function addProject(projectName) {
  const settings = await getSettings();
  if (!settings.projects.includes(projectName)) {
    settings.projects.push(projectName);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  return settings.projects;
}

export async function getBudgets() {
  try {
    const raw = await AsyncStorage.getItem(BUDGETS_KEY);
    return raw ? JSON.parse(raw) : { [DEFAULT_PROJECT]: {} };
  } catch (e) {
    return { [DEFAULT_PROJECT]: {} };
  }
}

export async function setBudgetAllocated(project, category, amount) {
  const budgets = await getBudgets();
  if (!budgets[project]) budgets[project] = {};
  if (!budgets[project][category]) budgets[project][category] = { allocated: 0, spent: 0 };
  budgets[project][category].allocated = Math.max(0, parseNumber(amount));
  await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
  return budgets;
}

export async function incrementBudgetSpent(project, category, usdAmount) {
  if (category === 'Income') return; // not counted against budgets
  const budgets = await getBudgets();
  if (!budgets[project]) budgets[project] = {};
  if (!budgets[project][category]) budgets[project][category] = { allocated: 0, spent: 0 };
  budgets[project][category].spent = parseNumber(budgets[project][category].spent) + Math.max(0, parseNumber(usdAmount));
  await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
  return budgets;
}

export async function resetBudgetsSpentForMonthIfNeeded(currentDate = new Date()) {
  // Optional: Could reset 'spent' monthly. For simplicity, keep cumulative.
  return getBudgets();
}

export async function getExpenses() {
  try {
    const raw = await AsyncStorage.getItem(EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveExpenses(expenses) {
  await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

export async function getCategories() {
  // Merge categories found in budgets and expenses with defaults
  const budgets = await getBudgets();
  const expenses = await getExpenses();
  const fromBudgets = new Set();
  Object.values(budgets || {}).forEach(projectObj => {
    Object.keys(projectObj || {}).forEach(c => fromBudgets.add(c));
  });
  const fromExpenses = new Set(expenses.map(e => e.category).filter(Boolean));
  const all = new Set([...DEFAULT_CATEGORIES, ...fromBudgets, ...fromExpenses]);
  return Array.from(all);
}

export async function getExchangeRates(force = false) {
  try {
    const settings = await getSettings();
    const cached = settings.lastRates;
    const now = Date.now();
    if (!force && cached && (now - (cached.timestamp || 0) < 24 * 60 * 60 * 1000)) {
      return cached;
    }
    const apiKey = Constants?.expoConfig?.extra?.exchangeRateApiKey || 'YOUR_API_KEY';
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Rates fetch failed ${res.status}`);
    const json = await res.json();
    const rates = {
      base: json.base_code || 'USD',
      rates: json.conversion_rates || {},
      timestamp: Date.now(),
    };
    await updateSettings({ lastRates: rates });
    return rates;
  } catch (e) {
    const settings = await getSettings();
    if (settings.lastRates) return settings.lastRates;
    // Fallback approximate rates if offline first run
    const fallback = { base: 'USD', rates: { USD: 1, EUR: 0.92, GBP: 0.78 }, timestamp: Date.now() };
    await updateSettings({ lastRates: fallback });
    return fallback;
  }
}

function advanceDate(dateISO, recurring) {
  const d = new Date(dateISO);
  if (recurring === 'daily') d.setDate(d.getDate() + 1);
  else if (recurring === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurring === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export async function applyRecurringTransactionsIfDue(now = new Date()) {
  const expenses = await getExpenses();
  let changed = false;
  for (const tx of expenses) {
    if (!tx.recurring || tx.recurring === 'none') continue;
    const lastApplied = tx.lastApplied || tx.date;
    let nextDateISO = advanceDate(lastApplied, tx.recurring);
    while (new Date(nextDateISO) <= now) {
      // clone transaction for next due date
      const clone = { ...tx, id: uuid(), date: nextDateISO, lastApplied: nextDateISO };
      expenses.push(clone);
      tx.lastApplied = nextDateISO;
      nextDateISO = advanceDate(nextDateISO, tx.recurring);
      changed = true;
    }
  }
  if (changed) await saveExpenses(expenses);
  return changed;
}

export async function addTransaction({
  type = 'expense', // 'expense' | 'income'
  amount,
  category,
  description = '',
  date = new Date().toISOString(),
  project = DEFAULT_PROJECT,
  currency = 'USD',
  receiptUri = null,
  recurring = 'none', // 'none' | 'daily' | 'weekly' | 'monthly'
  ocr = null,
}) {
  const amt = parseNumber(amount);
  if (!amt || !category) {
    throw new Error('Amount and category are required');
  }
  const rates = await getExchangeRates();
  const rateToUSD = (currency === 'USD') ? 1 : (rates?.rates?.[currency] ? 1 / (rates.rates[currency]) : 1);
  const usdAmount = type === 'income' ? amt * rateToUSD : amt * rateToUSD; // same conversion, sign handled below

  const tx = {
    id: uuid(),
    type,
    amount: amt,
    usdAmount: usdAmount,
    category,
    description,
    date,
    project,
    currency,
    rateToUSD,
    receiptUri,
    recurring,
    lastApplied: recurring !== 'none' ? date : null,
    ocr,
  };

  const all = await getExpenses();
  all.push(tx);
  await saveExpenses(all);

  if (type === 'expense') {
    await incrementBudgetSpent(project, category, usdAmount);
  }

  return tx;
}

export async function removeTransaction(id) {
  const all = await getExpenses();
  const next = all.filter(t => t.id !== id);
  await saveExpenses(next);
  return next;
}

export async function getSummary() {
  const expenses = await getExpenses();
  let income = 0;
  let expense = 0;
  for (const t of expenses) {
    if (t.type === 'income') income += t.usdAmount;
    else expense += t.usdAmount;
  }
  const netWorth = income - expense;
  return { income, expense, netWorth };
}

export function monthKey(dateISO) {
  const d = new Date(dateISO);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function monthlySeries() {
  const txs = await getExpenses();
  const map = {};
  for (const t of txs) {
    const key = monthKey(t.date);
    if (!map[key]) map[key] = { income: 0, expense: 0 };
    if (t.type === 'income') map[key].income += t.usdAmount; else map[key].expense += t.usdAmount;
  }
  const keys = Object.keys(map).sort();
  return keys.map(k => ({ month: k, ...map[k] }));
}

export async function searchTransactions(query) {
  const q = (query || '').trim().toLowerCase();
  const txs = await getExpenses();
  if (!q) return txs.sort((a,b) => new Date(b.date) - new Date(a.date));
  return txs
    .filter(t =>
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    )
    .sort((a,b) => new Date(b.date) - new Date(a.date));
}

export async function replaceAllData({ expenses, budgets, settings }) {
  if (expenses) await saveExpenses(expenses);
  if (budgets) await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
  if (settings) await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
