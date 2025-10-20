import { Platform } from 'react-native';
import * as tf from '@tensorflow/tfjs';
let tfReactNative;
try { tfReactNative = require('@tensorflow/tfjs-react-native'); } catch (e) { tfReactNative = null; }

import { monthKey } from './storage';

let tfReady = false;

async function ensureTFReady() {
  if (tfReady) return true;
  if (Platform.OS !== 'web' && tfReactNative?.bundleResourceIO) {
    // For RN, initialize the tfjs-react-native backend
    if (tfReactNative?.ready) {
      await tfReactNative.ready();
    }
  }
  await tf.ready();
  tfReady = true;
  return true;
}

function buildLSTM(inputTimesteps) {
  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 16, inputShape: [inputTimesteps, 1], returnSequences: false }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
  return model;
}

function smoothSeries(series, alpha = 0.3) {
  if (!series.length) return [];
  const out = [series[0]];
  for (let i = 1; i < series.length; i++) {
    out.push(alpha * series[i] + (1 - alpha) * out[i - 1]);
  }
  return out;
}

function detectSeasonality(monthlyMap) {
  // monthlyMap: { 'YYYY-MM': { expense, income } }
  const monthOfYear = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));
  Object.entries(monthlyMap).forEach(([k, v]) => {
    const m = parseInt(k.split('-')[1], 10) - 1;
    monthOfYear[m].sum += v.expense;
    monthOfYear[m].count += 1;
  });
  const averages = monthOfYear.map(m => (m.count ? m.sum / m.count : 0));
  let topIdx = 0;
  for (let i = 1; i < 12; i++) if (averages[i] > averages[topIdx]) topIdx = i;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { topMonthIndex: topIdx, topMonthName: monthNames[topIdx], monthlyAverages: averages };
}

export async function analyze(transactions) {
  await ensureTFReady();
  // Aggregate by month
  const monthly = {};
  (transactions || []).forEach(t => {
    const k = monthKey(t.date);
    if (!monthly[k]) monthly[k] = { expense: 0, income: 0 };
    if (t.type === 'income') monthly[k].income += t.usdAmount; else monthly[k].expense += t.usdAmount;
  });
  const keys = Object.keys(monthly).sort();
  const expenseSeries = keys.map(k => monthly[k].expense);

  let predictedNext = 0;
  if (expenseSeries.length >= 6) {
    // Prepare windowed data for LSTM
    const window = Math.min(6, Math.max(3, Math.floor(expenseSeries.length / 3)));
    const xs = [];
    const ys = [];
    for (let i = 0; i < expenseSeries.length - window; i++) {
      xs.push(expenseSeries.slice(i, i + window));
      ys.push(expenseSeries[i + window]);
    }
    const xTensor = tf.tensor(xs).reshape([xs.length, window, 1]);
    const yTensor = tf.tensor(ys).reshape([ys.length, 1]);
    const model = buildLSTM(window);
    try {
      await model.fit(xTensor, yTensor, { epochs: 40, batchSize: 8, verbose: 0 });
      const lastWindow = tf.tensor(expenseSeries.slice(-window)).reshape([1, window, 1]);
      const pred = model.predict(lastWindow);
      const val = (await pred.data())[0];
      predictedNext = Math.max(0, Number.isFinite(val) ? val : 0);
    } catch (e) {
      predictedNext = 0;
    }
    tf.dispose([xTensor, yTensor]);
  }
  if (!predictedNext) {
    const smoothed = smoothSeries(expenseSeries);
    predictedNext = smoothed[smoothed.length - 1] || 0;
  }

  // Seasonality
  const seasonality = detectSeasonality(monthly);

  // Top category last 90 days
  const byCat = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  (transactions || []).forEach(t => {
    if (t.type !== 'expense') return;
    if (new Date(t.date) < cutoff) return;
    byCat[t.category] = (byCat[t.category] || 0) + t.usdAmount;
  });
  let topCategory = 'N/A';
  let topValue = 0;
  Object.entries(byCat).forEach(([c, v]) => { if (v > topValue) { topValue = v; topCategory = c; } });

  // Suggestion
  let suggestion = 'Track high-variance categories and set tighter envelopes.';
  if (topCategory && topCategory !== 'N/A') suggestion = `Consider reducing spend in ${topCategory}.`;
  if (predictedNext > 0 && expenseSeries.length > 0) {
    const last = expenseSeries[expenseSeries.length - 1];
    if (predictedNext > last * 1.1) suggestion = 'Upcoming spend trend rising. Increase buffers or defer non-essentials.';
  }

  return {
    predictedNextMonthExpenseUSD: Math.round(predictedNext),
    seasonality,
    topCategory,
    suggestion,
  };
}

const Manager = { analyze };
export default Manager;
