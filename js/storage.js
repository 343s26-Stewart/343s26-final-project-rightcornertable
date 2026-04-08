/**
 * storage.js
 * Simple localStorage wrapper for Tripcast saved plans.
 */
const STORAGE_KEY = 'tripcast-saved-plans';

export function getSavedPlans() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Unable to parse saved plans from localStorage', err);
    return [];
  }
}

export function savePlan(plan) {
  const existing = getSavedPlans();
  const updated = [plan, ...existing];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deletePlan(planId) {
  const updated = getSavedPlans().filter((item) => item.id !== planId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearAllPlans() {
  localStorage.removeItem(STORAGE_KEY);
}
