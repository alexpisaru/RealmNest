// URLs in the page: normalization (tracking parameters out, fragment out, host lower-case),
// a quick local pre-check (the authoritative check is Rust's, at connect time), result
// de-duplication, and URLs written in a message.

import type { WebSearchResult } from '../../domain/web';

const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|mkt_tok|ref_src|spm|si)$/i;

/** the same resource without tracking parameters and fragment; undefined when not a web URL */
export function normalizeUrl(raw: string): string | undefined {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, '');
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  // a lone trailing "?" after removing everything
  let s = u.toString();
  if (s.endsWith('?')) s = s.slice(0, -1);
  return s;
}

export const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** second-level labels under a country code that are not registrable on their own (co.uk, com.au…) */
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'gob', 'go', 'or', 'ne', 'mil', 'nic', 'ltd', 'plc', 'sch']);
/** hosting suffixes where every subdomain belongs to someone else: only the same host is the same site */
const SHARED_HOSTS = ['github.io', 'gitlab.io', 'blogspot.com', 'herokuapp.com', 'netlify.app', 'vercel.app', 'pages.dev', 'workers.dev', 'appspot.com', 'web.app', 'firebaseapp.com', 'azurewebsites.net', 'cloudfront.net', 'amazonaws.com', 'wordpress.com', 'substack.com', 'medium.com', 'neocities.org', 'glitch.me', 'repl.co', 'onrender.com', 'fly.dev', 'surge.sh', 'tumblr.com', 'wixsite.com', 'weebly.com', 'myshopify.com', 'notion.site', 'ngrok.io', 'ngrok-free.app'];

/**
 * The site an address belongs to: its registrable domain (example.co.uk for a.b.example.co.uk),
 * approximated without the public suffix list; the whole host on shared hosting and for IPs.
 */
export function siteOf(url: string): string | undefined {
  let h: string;
  try {
    h = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return undefined;
  }
  if (!h) return undefined;
  if (h.startsWith('[') || /^\d+(\.\d+){3}$/.test(h)) return h;
  if (SHARED_HOSTS.some((s) => h === s || h.endsWith(`.${s}`))) return h;
  const labels = h.split('.');
  if (labels.length <= 2) return h;
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const take = tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
  return labels.slice(-take).join('.');
}

/** fast local refusal (no request): the Rust guard decides for real */
export function obviouslyBlocked(raw: string): string | undefined {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return 'not a valid web address';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return `the ${u.protocol} scheme is not allowed (only http and https)`;
  if (u.username || u.password) return 'addresses with a user name or password are not allowed';
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa|intranet|corp)$/.test(h) || (!h.includes('.') && !h.startsWith('['))) return `${h} is a local or intranet name`;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '[::1]' || /^\[(fc|fd|fe8|fe9|fea|feb)/.test(h)) return `${h} is a private or local address`;
  return undefined;
}

/** results without repeats: same normalized URL, or same title on the same domain */
export function dedupeResults(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  const out: WebSearchResult[] = [];
  for (const r of results) {
    const n = normalizeUrl(r.url);
    if (!n) continue;
    const key = n.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    const titleKey = `${domainOf(n)}|${r.title.trim().toLowerCase()}`;
    if (seen.has(key) || (r.title.trim() && seen.has(titleKey))) continue;
    seen.add(key);
    if (r.title.trim()) seen.add(titleKey);
    out.push({ ...r, url: n, ...(n !== r.url && { originalUrl: r.url }), domain: domainOf(n), id: `R${out.length + 1}` });
  }
  return out;
}

/** http(s) URLs written in a text, in order, normalized and without repeats */
export function urlsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>"'`)\]]+/gi)) {
    const n = normalizeUrl(m[0].replace(/[.,;:!?]+$/, ''));
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
