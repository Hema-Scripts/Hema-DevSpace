import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
let DocumentPicker;
try { DocumentPicker = require('expo-document-picker'); } catch (e) { DocumentPicker = null; }

import { getExpenses, getBudgets, getSettings, replaceAllData } from './storage';

function nowFileStamp() { const d = new Date(); return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}_${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}`; }

export async function exportDataJSON() {
  const [expenses, budgets, settings] = await Promise.all([getExpenses(), getBudgets(), getSettings()]);
  const data = { meta: { app: 'Expense Tracker Pro', version: 1 }, expenses, budgets, settings };
  const json = JSON.stringify(data, null, 2);
  const fileUri = FileSystem.cacheDirectory + `expense_tracker_export_${nowFileStamp()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
  return fileUri;
}

export async function exportCSV() {
  const txs = await getExpenses();
  const header = 'id,type,amount,usdAmount,category,description,date,project,currency,rateToUSD,receiptUri,recurring\n';
  const rows = txs.map(t => [t.id, t.type, t.amount, t.usdAmount, t.category, (t.description||'').replace(/\n/g,' '), t.date, t.project, t.currency, t.rateToUSD, t.receiptUri||'', t.recurring||'none'].map(v => `"${String(v ?? '')}"`).join(','));
  const csv = header + rows.join('\n');
  const fileUri = FileSystem.cacheDirectory + `transactions_${nowFileStamp()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return fileUri;
}

export async function shareFile(fileUri, mimeType = undefined) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this platform');
    }
  await Sharing.shareAsync(fileUri, { mimeType });
}

export async function exportAndShareJSON() {
  const uri = await exportDataJSON();
  await shareFile(uri, 'application/json');
  return uri;
}

export async function exportAndShareCSV() {
  const uri = await exportCSV();
  await shareFile(uri, 'text/csv');
  return uri;
}

export async function importFromJSONPicker() {
  if (!DocumentPicker) throw new Error('Document picker not available');
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled || !result.assets || !result.assets[0]) return null;
  const asset = result.assets[0];
  const uri = asset.uri;
  const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  const parsed = JSON.parse(content);
  const { expenses, budgets, settings } = parsed || {};
  if (!expenses || !budgets || !settings) throw new Error('Invalid backup file');
  await replaceAllData({ expenses, budgets, settings });
  return { expensesCount: expenses.length };
}
