// 把价值手册（用户可编辑）持久化到 localStorage
import { DIMENSIONS } from '../data/defaultHandbook.js'

const KEY = 'vc_handbook_v3' // v3: 莫兰迪配色（黑白极简 UI）

export function loadHandbook() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return structuredClone(DIMENSIONS)
}

export function saveHandbook(dims) {
  localStorage.setItem(KEY, JSON.stringify(dims))
}

export function resetHandbook() {
  localStorage.removeItem(KEY)
  return structuredClone(DIMENSIONS)
}
