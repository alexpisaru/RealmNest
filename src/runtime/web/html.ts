// Readable content from HTML, as data only. The page's HTML is tokenized here (no DOM, no
// script, no style, no network): nothing in it can run. Steps:
//   tokens → a tolerant tree → junk removed (scripts, styles, nav, header/footer of the site,
//   cookie and consent banners, ads, share bars, sidebars, forms, hidden elements)
//   → the main content (article / main / the densest text block) → Markdown-like text
//   (headings, paragraphs, lists, quotes, code, tables) + links + metadata the page states
//   (title, canonical, language, author, published / updated dates). Nothing is guessed:
//   no date or author unless the page declares one.

export interface HtmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: (HtmlNode | string)[];
}

const VOID = new Set('area base br col embed hr img input link meta source track wbr param keygen'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'xmp', 'iframe', 'noembed', 'noframes', 'template']);
const DROP = new Set('script style noscript template svg math canvas iframe object embed video audio picture source form button select input textarea nav footer aside dialog label map head'.split(' '));
const BLOCK = new Set('p div section article main header footer aside nav ul ol li dl dt dd h1 h2 h3 h4 h5 h6 blockquote pre table thead tbody tfoot tr td th figure figcaption hr br address details summary'.split(' '));
const JUNK = /(^|[\s_-])(nav|navbar|navigation|menu|breadcrumbs?|cookie|cookies|consent|gdpr|banner|advert|advertisement|ads?|sponsor(ed)?|promo|social|share|sharing|related|recommended?|newsletter|subscribe|signup|popup|modal|overlay|sidebar|footer|comments?|disqus|outbrain|taboola|toolbar|skip|paywall|masthead)([\s_-]|$)/i;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥', cent: '¢', middot: '·', bull: '•', times: '×', divide: '÷', deg: '°', plusmn: '±', para: '¶', sect: '§',
  agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ograve: 'ò', oacute: 'ó', ocirc: 'ô', ouml: 'ö',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ', szlig: 'ß', Agrave: 'À', Eacute: 'É', Egrave: 'È', Ograve: 'Ò', Ugrave: 'Ù', Ccedil: 'Ç', Ntilde: 'Ñ', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
  rarr: '→', larr: '←', shy: '', zwj: '', zwnj: '', thinsp: ' ', ensp: ' ', emsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,10});?/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

/** a tolerant tree: unknown nesting is flattened, never fatal */
export function parseHtml(html: string): HtmlNode {
  const root: HtmlNode = { tag: '#root', attrs: {}, children: [] };
  const stack: HtmlNode[] = [root];
  const top = () => stack[stack.length - 1];
  const close = (tag: string) => {
    for (let i = stack.length - 1; i > 0; i--)
      if (stack[i].tag === tag) {
        stack.length = i;
        return;
      }
  };
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      top().children.push(html.slice(i));
      break;
    }
    if (lt > i) top().children.push(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(html.slice(lt, lt + 4096));
    if (!m) {
      top().children.push('<');
      i = lt + 1;
      continue;
    }
    i = lt + m[0].length;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      close(tag);
      continue;
    }
    const node: HtmlNode = { tag, attrs: parseAttrs(m[3]), children: [] };
    // a new paragraph / item closes the open one (common unclosed tags)
    if ((tag === 'p' || BLOCK.has(tag)) && top().tag === 'p' && tag !== 'br') close('p');
    if (tag === 'li' && top().tag === 'li') close('li');
    if ((tag === 'td' || tag === 'th') && (top().tag === 'td' || top().tag === 'th')) stack.length--;
    if (tag === 'tr' && stack.some((s) => s.tag === 'tr')) close('tr');
    top().children.push(node);
    if (RAW.has(tag)) {
      const endRe = new RegExp(`</${tag}\\s*>`, 'i');
      const rest = html.slice(i);
      const em = endRe.exec(rest);
      const raw = em ? rest.slice(0, em.index) : rest;
      node.children.push(raw);
      i += em ? em.index + em[0].length : rest.length;
      continue;
    }
    if (!VOID.has(tag) && !m[3].trim().endsWith('/')) stack.push(node);
  }
  return root;
}

const textOf = (n: HtmlNode | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));

function* walk(n: HtmlNode): Generator<HtmlNode> {
  yield n;
  for (const c of n.children) if (typeof c !== 'string') yield* walk(c);
}

export interface PageMeta {
  title?: string;
  siteName?: string;
  description?: string;
  canonical?: string;
  lang?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  ogType?: string;
  /** the page's preview picture (og:image / twitter:image), an absolute http(s) address */
  image?: string;
}

const isoish = (s: string | undefined) => {
  if (!s) return undefined;
  const t = s.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) && !Number.isNaN(Date.parse(t)) ? t.slice(0, 40) : undefined;
};

/** what the page itself declares (meta tags, JSON-LD, <time itemprop>), nothing inferred */
export function readMeta(root: HtmlNode, base: string): PageMeta {
  const meta: PageMeta = {};
  const metaOf = (key: string) => {
    for (const n of walk(root)) if (n.tag === 'meta' && ((n.attrs.property ?? n.attrs.name ?? '').toLowerCase() === key) && n.attrs.content?.trim()) return n.attrs.content.trim();
    return undefined;
  };
  for (const n of walk(root)) {
    if (n.tag === 'html' && n.attrs.lang) meta.lang ??= n.attrs.lang.slice(0, 20);
    if (n.tag === 'title' && !meta.title) meta.title = decodeEntities(textOf(n)).replace(/\s+/g, ' ').trim().slice(0, 300) || undefined;
    if (n.tag === 'link' && /(^|\s)canonical(\s|$)/i.test(n.attrs.rel ?? '') && n.attrs.href) {
      try {
        meta.canonical ??= new URL(n.attrs.href, base).toString();
      } catch {
        /* not a URL */
      }
    }
  }
  const og = metaOf('og:title');
  // the page's own headline beats a <title> padded with the site name, unless og:title is only the
  // site's name inside a more specific <title> ("serde - crates.io: Rust Package Registry")
  if (og && !(meta.title && meta.title.length > og.length && meta.title.includes(og))) meta.title = og.slice(0, 300);
  meta.siteName = metaOf('og:site_name')?.slice(0, 120);
  meta.description = (metaOf('description') ?? metaOf('og:description'))?.slice(0, 500);
  meta.ogType = metaOf('og:type');
  const img = metaOf('og:image:secure_url') ?? metaOf('og:image') ?? metaOf('og:image:url') ?? metaOf('twitter:image') ?? metaOf('twitter:image:src');
  if (img && img.length < 1000) {
    try {
      const u = new URL(img, base);
      if (u.protocol === 'https:' || u.protocol === 'http:') meta.image = u.toString();
    } catch {
      /* not a URL */
    }
  }
  meta.author = (metaOf('author') ?? metaOf('article:author') ?? metaOf('dc.creator'))?.slice(0, 200);
  if (meta.author && /^https?:\/\//.test(meta.author)) delete meta.author;
  meta.publishedAt = isoish(metaOf('article:published_time') ?? metaOf('datepublished') ?? metaOf('dc.date') ?? metaOf('date') ?? metaOf('pubdate'));
  meta.updatedAt = isoish(metaOf('article:modified_time') ?? metaOf('og:updated_time') ?? metaOf('datemodified'));
  // JSON-LD: Article / NewsArticle / BlogPosting
  for (const n of walk(root)) {
    if (n.tag !== 'script' || !/ld\+json/i.test(n.attrs.type ?? '')) continue;
    let data: unknown;
    try {
      data = JSON.parse(textOf(n));
    } catch {
      continue;
    }
    const items = (Array.isArray(data) ? data : [data]).flatMap((d) => (d && typeof d === 'object' && Array.isArray((d as { '@graph'?: unknown[] })['@graph']) ? (d as { '@graph': unknown[] })['@graph'] : [d]));
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Record<string, unknown>;
      const type = String(Array.isArray(o['@type']) ? o['@type'].join(' ') : (o['@type'] ?? ''));
      if (!/Article|BlogPosting|Report|WebPage/i.test(type)) continue;
      meta.publishedAt ??= isoish(typeof o.datePublished === 'string' ? o.datePublished : undefined);
      meta.updatedAt ??= isoish(typeof o.dateModified === 'string' ? o.dateModified : undefined);
      const a = Array.isArray(o.author) ? o.author[0] : o.author;
      const name = typeof a === 'string' ? a : a && typeof a === 'object' && typeof (a as { name?: unknown }).name === 'string' ? (a as { name: string }).name : undefined;
      if (name && !meta.author) meta.author = name.slice(0, 200);
      if (typeof o.headline === 'string' && !meta.title) meta.title = o.headline.slice(0, 300);
    }
  }
  for (const n of walk(root)) {
    if (n.tag === 'time' && /datepublished/i.test(n.attrs.itemprop ?? '')) meta.publishedAt ??= isoish(n.attrs.datetime);
    if (n.tag === 'time' && /datemodified/i.test(n.attrs.itemprop ?? '')) meta.updatedAt ??= isoish(n.attrs.datetime);
    if (!meta.author && /author/i.test(n.attrs.itemprop ?? '') && n.tag !== 'meta') {
      const t = decodeEntities(textOf(n)).replace(/\s+/g, ' ').trim();
      if (t && t.length < 80) meta.author = t;
    }
  }
  return meta;
}

const isJunk = (n: HtmlNode): boolean => {
  if (DROP.has(n.tag)) return true;
  if ('hidden' in n.attrs || n.attrs['aria-hidden'] === 'true') return true;
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.attrs.style ?? '')) return true;
  if (/^(navigation|banner|contentinfo|complementary|dialog|alertdialog|search|menu|menubar)$/i.test(n.attrs.role ?? '')) return true;
  if (n.tag === 'header' || n.tag === 'article' || n.tag === 'main' || n.tag === 'body' || n.tag === 'html') return false;
  return JUNK.test(`${n.attrs.class ?? ''} ${n.attrs.id ?? ''}`);
};

function prune(n: HtmlNode): HtmlNode {
  return { ...n, children: n.children.filter((c) => typeof c === 'string' || !isJunk(c)).map((c) => (typeof c === 'string' ? c : prune(c))) };
}

const plain = (n: HtmlNode) => decodeEntities(textOf(n)).replace(/\s+/g, ' ').trim();

/** the element that holds the content: <main>, else the article that is most of the articles, else the densest block of paragraphs */
function mainContent(body: HtmlNode): HtmlNode {
  const articles = [...walk(body)].filter((n) => n.tag === 'article');
  const longest = articles.sort((a, b) => plain(b).length - plain(a).length)[0];
  const main = [...walk(body)].find((n) => n.tag === 'main' || /^main$/i.test(n.attrs.role ?? ''));
  if (main) {
    // the page's own main region: an article inside it (a README on a package page) keeps the heading and facts around it
    if (plain(main).length > 200) return main;
  }
  if (longest && plain(longest).length > 300) {
    const total = articles.reduce((n, a) => n + plain(a).length, 0);
    if (articles.length === 1 || plain(longest).length >= total * 0.6) return longest;
  }
  // score blocks by the text of their own paragraphs, minus link text
  let best: HtmlNode = body;
  let bestScore = 0;
  for (const n of walk(body)) {
    if (!['div', 'section', 'td', 'body'].includes(n.tag)) continue;
    let score = 0;
    for (const c of n.children) {
      if (typeof c === 'string' || !['p', 'pre', 'blockquote', 'ul', 'ol', 'h2', 'h3', 'table'].includes(c.tag)) continue;
      const t = plain(c).length;
      const links = [...walk(c)].filter((x) => x.tag === 'a').reduce((s, a) => s + plain(a).length, 0);
      score += Math.max(0, t - links * 1.5);
    }
    if (score > bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return bestScore > 150 ? best : body;
}

/** Markdown-like text; links collected apart (absolute http(s) only) */
function render(n: HtmlNode, base: string, links: string[]): string {
  const out: string[] = [];
  const inline = (x: HtmlNode | string): string => {
    if (typeof x === 'string') return decodeEntities(x).replace(/\s+/g, ' ');
    if (x.tag === 'br') return '\n';
    if (x.tag === 'img') return x.attrs.alt?.trim() ? ` ${x.attrs.alt.trim()} ` : '';
    if (x.tag === 'a' && x.attrs.href && links.length < 80) {
      try {
        const u = new URL(x.attrs.href, base);
        if ((u.protocol === 'http:' || u.protocol === 'https:') && !links.includes(u.toString())) links.push(u.toString());
      } catch {
        /* not a link */
      }
    }
    const t = x.children.map(inline).join('');
    if (x.tag === 'code' && !t.includes('\n')) return `\`${t.trim()}\``;
    return t;
  };
  const block = (x: HtmlNode | string, depth: number, ordered = 0): void => {
    if (typeof x === 'string') {
      const t = decodeEntities(x).replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
      return;
    }
    const tag = x.tag;
    if (/^h[1-6]$/.test(tag)) {
      const t = inline(x).replace(/\s+/g, ' ').trim();
      if (t) out.push(`\n${'#'.repeat(Number(tag[1]))} ${t}\n`);
      return;
    }
    if (tag === 'p' || tag === 'figcaption' || tag === 'summary' || tag === 'dt' || tag === 'address') {
      const t = inline(x).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
      if (t) out.push(`\n${t}\n`);
      return;
    }
    if (tag === 'dd') {
      const t = inline(x).replace(/\s+/g, ' ').trim();
      if (t) out.push(`  ${t}`);
      return;
    }
    if (tag === 'pre') {
      const t = decodeEntities(textOf(x)).replace(/\s+$/, '');
      if (t.trim()) out.push(`\n\`\`\`\n${t.slice(0, 4000)}\n\`\`\`\n`);
      return;
    }
    if (tag === 'blockquote') {
      const t = inline(x).replace(/\s+/g, ' ').trim();
      if (t) out.push(`\n> ${t}\n`);
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      out.push('');
      let k = 0;
      for (const c of x.children) if (typeof c !== 'string') block(c, depth + 1, tag === 'ol' ? ++k : 0);
      out.push('');
      return;
    }
    if (tag === 'li') {
      const nested = x.children.filter((c): c is HtmlNode => typeof c !== 'string' && (c.tag === 'ul' || c.tag === 'ol'));
      const own = { ...x, children: x.children.filter((c) => typeof c === 'string' || !nested.includes(c)) };
      const t = inline(own).replace(/\s+/g, ' ').trim();
      if (t) out.push(`${'  '.repeat(Math.max(0, depth - 1))}${ordered ? `${ordered}.` : '-'} ${t}`);
      for (const c of nested) block(c, depth + 1);
      return;
    }
    if (tag === 'table') {
      const rows = [...walk(x)].filter((r) => r.tag === 'tr').slice(0, 60);
      const lines = rows
        .map((r) => r.children.filter((c): c is HtmlNode => typeof c !== 'string' && (c.tag === 'td' || c.tag === 'th')).map((c) => plain(c).replace(/\|/g, '/').slice(0, 200)))
        .filter((cells) => cells.some(Boolean))
        .map((cells) => `| ${cells.join(' | ')} |`);
      if (lines.length) out.push(`\n${lines.join('\n')}\n`);
      return;
    }
    if (tag === 'hr') return;
    // containers (div, section, article, span soup…): inline text runs become paragraphs
    let run: (HtmlNode | string)[] = [];
    const flush = () => {
      const t = run.map(inline).join('').replace(/[ \t]+/g, ' ').trim();
      if (t) out.push(`\n${t}\n`);
      run = [];
    };
    for (const c of x.children) {
      if (typeof c === 'string' || !BLOCK.has(c.tag)) run.push(c);
      else {
        flush();
        block(c, depth);
      }
    }
    flush();
  };
  block(n, 0);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

export interface Extracted {
  meta: PageMeta;
  text: string;
  links: string[];
  /** the page looks like an app shell that builds its content with JavaScript */
  needsJs: boolean;
  /** which block the text came from (debug) */
  root: string;
}

export function extractHtml(html: string, base: string): Extracted {
  const tree = parseHtml(html);
  const meta = readMeta(tree, base);
  const body = [...walk(tree)].find((n) => n.tag === 'body') ?? tree;
  const scripts = [...walk(tree)].filter((n) => n.tag === 'script' && !/ld\+json/i.test(n.attrs.type ?? '')).length;
  const noscript = [...walk(tree)].filter((n) => n.tag === 'noscript').map((n) => textOf(n)).join(' ');
  const clean = prune(body);
  const main = mainContent(clean);
  const links: string[] = [];
  let text = render(main, base, links);
  // a title heading at the top when the content lacks one
  if (meta.title && !/^#\s/.test(text) && !text.slice(0, 300).includes(meta.title.slice(0, 40))) text = `# ${meta.title}\n\n${text}`;
  const bodyText = plain(clean).length;
  // an app shell: little text, scripts, and a sign it is waiting for them (a JavaScript notice, an empty
  // mount point, or next to no text). A short static page with a script (example.com) is not one.
  const jsNotice = /enable javascript|requires javascript|turn on javascript|javascript is (disabled|required)/i.test(`${noscript} ${plain(body)}`);
  const emptyMount = [...walk(body)].some((n) => (/^(root|app|__next|__nuxt|svelte|ember-app|main-app|application)$/i.test(n.attrs.id ?? '') || 'data-reactroot' in n.attrs || 'ng-version' in n.attrs) && plain(n).length < 20);
  const needsJs = bodyText < 400 && (scripts > 0 || /javascript/i.test(noscript)) && (jsNotice || emptyMount || bodyText < 60);
  const root = main.tag + (main.attrs.id ? `#${main.attrs.id}` : '') + (main.attrs.class ? `.${main.attrs.class.split(/\s+/)[0]}` : '');
  return { meta, text, links, needsJs, root };
}

/** the charset a document declares in its first bytes (<meta charset>, http-equiv) */
export function sniffCharset(head: string): string | undefined {
  const m = /<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9_-]+)/i.exec(head);
  return m?.[1]?.toLowerCase();
}
