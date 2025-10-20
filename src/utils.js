// ===== utils.js (local-date helpers, DOM helpers, CSV + safe fetchers) =====

// Local ISO date (YYYY-MM-DD) — NO UTC SHIFT
export function iso(d){
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, '0');
  const day = String(dd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d){
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function addDays(d, n){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

// Tiny DOM helper
export function el(tag, attrs={}, ...children){
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})){
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children){
    if (c == null) continue;
    if (c instanceof Node) node.appendChild(c);
    else node.appendChild(document.createTextNode(String(c)));
  }
  return node;
}

// Small badge span used in calendar legend
export function badge(text){
  const s = document.createElement('span');
  s.className = 'badge';
  s.textContent = text;
  return s;
}

/* ------------------------------------------------------------------ */
/* Safe JSON loader used by main/app code                              */
/* - Returns {} on 404 or network errors so the UI never blanks        */
/* - Adds cache-busting unless the URL already has a query string      */
/* ------------------------------------------------------------------ */
export async function loadJSON(path){
  try {
    const url = path.includes('?') ? path : `${path}?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* CSV utilities                                                       */
/* ------------------------------------------------------------------ */

// Convert a CSV string into an array of string[] rows.
export function parseCSV(text){
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  const pushField = () => { row.push(field); field=''; };
  const pushRow = () => { rows.push(row.map(c => c.trim())); row=[]; };

  while (i < text.length){
    const ch = text[i++];
    if (inQuotes){
      if (ch === '"'){
        if (text[i] === '"'){ field += '"'; i++; }  // escaped quote
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"'){ inQuotes = true; }
      else if (ch === ','){ pushField(); }
      else if (ch === '\n'){ pushField(); pushRow(); }
      else if (ch === '\r'){ /* ignore CR */ }
      else { field += ch; }
    }
  }
  if (field.length || row.length){ pushField(); pushRow(); }
  return rows.filter(r => r.some(c => c !== ''));
}

// Numeric extractor for sheets like "₹ 3,500"
export function toNumber(x){
  if (x == null) return NaN;
  const m = String(x).replace(/[,₹\s]/g,'').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

/* ------------------------------------------------------------------ */
/* Object helpers                                                      */
/* ------------------------------------------------------------------ */

// pick(obj, 'a','b')  or  pick(obj, ['a','b'])
export function pick(obj, ...keys){
  if (!obj) return {};
  if (keys.length === 1 && Array.isArray(keys[0])) keys = keys[0];
  const out = {};
  for (const k of keys){
    if (Object.prototype.hasOwnProperty.call(obj, k)){
      out[k] = obj[k];
    }
  }
  return out;
}
