// Сборка статического сайта: content/*.md -> dist/*.html
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const root = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const showDrafts = process.argv.includes('--drafts');
const out = path.join(root, 'dist');
const base = cfg.url.replace(/\/$/, '');

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function parseMd(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split(/\r?\n/)) {
      const k = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!k) continue;
      let v = k[2].trim().replace(/^["']|["']$/g, '');
      if (v === 'true') v = true;
      else if (v === 'false') v = false;
      meta[k[1]] = v;
    }
  }
  return { meta, body };
}

const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const readMin = (text) => Math.max(1, Math.round(text.split(/\s+/).length / 200));

// --- читаем статьи
const postsDir = path.join(root, 'content', 'posts');
const posts = fs.existsSync(postsDir)
  ? fs.readdirSync(postsDir).filter((f) => f.endsWith('.md')).map((f) => {
      const { meta, body } = parseMd(path.join(postsDir, f));
      const slug = meta.slug || f.replace(/\.md$/, '');
      return { ...meta, slug, body, html: marked.parse(body), minutes: readMin(body), url: `/posts/${slug}/` };
    }).filter((p) => showDrafts || !p.draft).sort((a, b) => new Date(b.date) - new Date(a.date))
  : [];

// --- общий каркас страницы
function layout({ title, description, path: p, body, hero = '', ld = [], type = 'website', current = '', noindex = false }) {
  const full = title === cfg.name ? title : `${title} | ${cfg.name}`;
  const canonical = base + p;
  const L = cfg.links;
  const social = [['Telegram', L.telegram], ['Threads', L.threads], ['LinkedIn', L.linkedin]].filter(([, u]) => u);
  const tg = L.telegram ? `<a class="pill" href="${esc(L.telegram)}" rel="noopener">Telegram</a>` : '';
  const nav = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="${cfg.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.name)}" href="/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${ld.map(jsonLd).join('\n')}
</head>
<body>
<a class="skip" href="#content">Перейти к содержимому</a>
<div class="band-dark">
<div class="wrap">
<header class="top">
  <a class="logo" href="/">${esc(cfg.name)}</a>
  <nav class="main" aria-label="Основное меню">
    ${nav('/', 'Главная', 'home')}
    ${nav('/analitika/', 'Аналитика', 'blog')}
    ${nav('/ob-avtore/', 'Об авторе', 'about')}
    ${tg}
  </nav>
</header>
</div>
${hero || ''}
</div>
<main id="content">
${body}
</main>
<footer class="bottom">
<div class="wrap">
  ${social.length ? `<div class="soc">${social.map(([n, u]) => `<a href="${esc(u)}" rel="noopener">${n}</a>`).join('')}</div>` : ''}
  <p>${esc(cfg.disclaimer)}</p>
  <p>© ${new Date().getFullYear()} ${esc(cfg.author.name)}</p>
</div>
</footer>
</body>
</html>`;
}

const row = (p) => `<article class="entry">
  <div class="entry-meta">${fmtDate(p.date)}${p.category ? ' · ' + esc(p.category) : ''} · ${p.minutes} мин</div>
  <h3><a href="${p.url}">${esc(p.title)}</a></h3>
  <p>${esc(p.description || '')}</p>
</article>`;

const list = (items) => items.length
  ? `<div class="entries">${items.map(row).join('')}</div>`
  : `<p class="empty">Первые материалы появятся здесь совсем скоро.</p>`;

const person = {
  '@type': 'Person', '@id': `${base}/#author`, name: cfg.author.name, jobTitle: cfg.author.jobTitle,
  url: `${base}/ob-avtore/`, sameAs: Object.values(cfg.links).filter(Boolean).filter((u) => /^https?:/.test(u)),
};

const write = (rel, content) => {
  const f = path.join(out, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
};

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'style.css'), path.join(out, 'style.css'));
const staticDir = path.join(root, 'static');
if (fs.existsSync(staticDir)) fs.cpSync(staticDir, out, { recursive: true });

const tgBtn = (cls, text) => cfg.links.telegram ? `<a class="btn ${cls}" href="${esc(cfg.links.telegram)}" rel="noopener">${text}</a>` : '';
// блок подписки: форма рассылки, а если её нет, кнопка Telegram; если нет ничего, блока нет
let nlId = 0;
const newsletter = (title = 'Не пропустите новые разборы') => {
  const id = `nl${++nlId}`;
  if (cfg.links.newsletter) return `<section class="signup" aria-labelledby="${id}"><div class="narrow">
  <h2 id="${id}">${esc(title)}</h2><p>Раз в неделю, только материалы блога. Без спама.</p>
  <form action="${esc(cfg.links.newsletter)}" method="post">
    <label class="sr" for="${id}e">Email</label>
    <input id="${id}e" name="email" type="email" placeholder="you@email.com" required>
    <button type="submit">Подписаться</button>
  </form></div></section>`;
  if (cfg.links.telegram) return `<section class="signup" aria-labelledby="${id}"><div class="narrow">
  <h2 id="${id}">${esc(title)}</h2><p>Короткие заметки и анонсы разборов в Telegram-канале.</p>
  <a class="btn" href="${esc(cfg.links.telegram)}" rel="noopener">Подписаться в Telegram</a></div></section>`;
  return '';
};

// --- главная
write('index.html', layout({
  title: cfg.name, description: cfg.description, path: '/', current: 'home',
  ld: [{ '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${base}/#site`, url: `${base}/`, name: cfg.name, description: cfg.description, inLanguage: cfg.lang, publisher: { '@id': `${base}/#author` } },
    person,
  ] }],
  hero: `<section class="hero"><div class="narrow">
  <h1>${esc(cfg.name)}</h1>
  <h2>Разборы компаний, рынков и исторических аналогий. Без хайпа, с источниками и оговорками.</h2>
  <div class="cta"><a class="btn yellow" href="/analitika/">Читать аналитику</a>${tgBtn('outline', 'Подписаться в Telegram')}</div>
</div></section>`,
  body: `<div class="narrow">
<h2 class="section-title">Последние материалы</h2>
${list(posts.slice(0, 5))}
${posts.length ? '<p class="more"><a href="/analitika/">Все материалы →</a></p>' : ''}
</div>
${newsletter()}
<div class="narrow">
<section class="about-strip" aria-labelledby="ab">
  <div class="ph" role="img" aria-label="Место для фото автора"></div>
  <div><h2 id="ab">Об авторе</h2>
  <p>${esc(cfg.author.name)}, ${esc(cfg.author.jobTitle.toLowerCase())}. Смотрю на компании как на модели: что в них заложено и что можно проверить.</p>
  <a href="/ob-avtore/">Читать дальше →</a></div>
</section>
</div>`,
}));

// --- список статей
write('analitika/index.html', layout({
  title: 'Аналитика', description: 'Все материалы блога: рынки, компании, история.', path: '/analitika/', current: 'blog',
  ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Аналитика', url: `${base}/analitika/`, inLanguage: cfg.lang }],
  body: `<div class="narrow">
<div class="crumbs"><a href="/">Главная</a> / Аналитика</div>
<h1 class="page-title">Аналитика</h1>
${list(posts)}
</div>
${newsletter()}`,
}));

// --- статьи
for (const p of posts) {
  const url = base + p.url;
  write(`posts/${p.slug}/index.html`, layout({
    title: p.title, description: p.description || cfg.description, path: p.url, type: 'article', current: 'blog',
    noindex: !!p.draft,
    ld: [
      { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description || '', datePublished: p.date, dateModified: p.updated || p.date, inLanguage: cfg.lang, mainEntityOfPage: url, author: { '@id': `${base}/#author` }, publisher: { '@id': `${base}/#author` } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name: 'Аналитика', item: `${base}/analitika/` },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ] },
      { '@context': 'https://schema.org', ...person },
    ],
    body: `<div class="narrow">
<div class="crumbs"><a href="/">Главная</a> / <a href="/analitika/">Аналитика</a></div>
<article class="post">
  <div class="meta">${esc(p.category || '')}${p.category ? ' · ' : ''}${fmtDate(p.date)} · ${p.minutes} мин</div>
  <h1>${esc(p.title)}</h1>
  ${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}
  <div class="prose">${p.html}</div>
</article>
</div>
${newsletter()}`,
  }));
}

// --- об авторе
const about = parseMd(path.join(root, 'content', 'about.md'));
write('ob-avtore/index.html', layout({
  title: 'Об авторе', description: about.meta.description || `${cfg.author.name}: ${cfg.author.jobTitle}.`, path: '/ob-avtore/', current: 'about',
  ld: [{ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: person }],
  body: `<div class="narrow"><article class="post"><h1>Об авторе</h1><div class="prose">${marked.parse(about.body)}</div></article></div>
${newsletter()}`,
}));

// --- 404, robots, sitemap, rss
write('404.html', layout({ title: 'Страница не найдена', description: 'Такой страницы нет.', path: '/404.html', noindex: true,
  body: `<div class="narrow" style="text-align:center;padding:72px 32px"><h1 class="page-title">404</h1><p>Такой страницы нет.</p><p><a class="btn yellow" style="background:#f2c230;color:#15130f" href="/">На главную</a></p></div>` }));
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
const urls = ['/', '/analitika/', '/ob-avtore/', ...posts.filter((p) => !p.draft).map((p) => p.url)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(cfg.name)}</title><link>${base}/</link><description>${esc(cfg.description)}</description><language>${cfg.lang}</language>\n${posts.filter((p) => !p.draft).map((p) => `<item><title>${esc(p.title)}</title><link>${base}${p.url}</link><guid>${base}${p.url}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.description || '')}</description></item>`).join('\n')}\n</channel></rss>\n`);

console.log(`Готово: ${posts.length} статей${showDrafts ? ' (с черновиками)' : ''} -> dist/`);
