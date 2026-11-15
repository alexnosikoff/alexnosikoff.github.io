// Сборка двуязычного статического сайта: content/<lang>/*.md -> dist/
// uk (по умолчанию) живёт в корне, ru в /ru/
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const root = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const showDrafts = process.argv.includes('--drafts');
const out = path.join(root, 'dist');
const base = cfg.url.replace(/\/$/, '');
const LANGS = ['uk', 'ru'];
const DEFAULT = 'uk';

const T = {
  uk: {
    htmlLang: 'uk', locale: 'uk_UA', dates: 'uk-UA', label: 'UA',
    home: 'Головна', blog: 'Аналітика', about: 'Про автора',
    menu: 'Основне меню', langLabel: 'Мова', skip: 'Перейти до вмісту', min: 'хв',
    heroSub: 'Розбори компаній, ринків та історичних аналогій. Без хайпу, з джерелами та застереженнями.',
    read: 'Читати аналітику', subTg: 'Підписатися в Telegram',
    latest: 'Останні матеріали', all: 'Усі матеріали →',
    empty: 'Перші матеріали з’являться тут зовсім скоро.',
    signupTitle: 'Не пропустіть нові розбори',
    signupForm: 'Раз на тиждень, лише матеріали блогу. Без спаму.',
    signupTg: 'Короткі нотатки та анонси розборів у Telegram-каналі.',
    subscribe: 'Підписатися',
    aboutBlurb: 'Керівник фінансового планування та аналізу. Дивлюся на компанії як на моделі: що в них закладено і що можна перевірити.',
    more: 'Читати далі →',
    job: 'Керівник фінансового планування та аналізу',
    disclaimer: 'Матеріали мають інформаційний характер і не є інвестиційною рекомендацією. Інвестиції пов’язані з ризиком втрати капіталу.',
    siteDesc: 'Незалежна інвестиційна аналітика: розбори компаній, ринків та історичних аналогій із джерелами та застереженнями.',
    blogDesc: 'Усі матеріали блогу: ринки, компанії, історія.',
    nf: 'Такої сторінки немає.', toHome: 'На головну', photoAlt: 'Фото: Oleksandr Nosikov',
    video: 'Відео', videoDesc: 'Відеорозбори компаній і ринків з каналу на YouTube.', latestVideo: 'Останні відео', allVideo: 'Усі відео →', play: 'Відтворити відео', noVideo: 'Відео з’явиться тут після публікації', watchOn: 'Дивитися також на YouTube', timecodes: 'Зміст',
  },
  ru: {
    htmlLang: 'ru', locale: 'ru_RU', dates: 'ru-RU', label: 'RU',
    home: 'Главная', blog: 'Аналитика', about: 'Об авторе',
    menu: 'Основное меню', langLabel: 'Язык', skip: 'Перейти к содержимому', min: 'мин',
    heroSub: 'Разборы компаний, рынков и исторических аналогий. Без хайпа, с источниками и оговорками.',
    read: 'Читать аналитику', subTg: 'Подписаться в Telegram',
    latest: 'Последние материалы', all: 'Все материалы →',
    empty: 'Первые материалы появятся здесь совсем скоро.',
    signupTitle: 'Не пропустите новые разборы',
    signupForm: 'Раз в неделю, только материалы блога. Без спама.',
    signupTg: 'Короткие заметки и анонсы разборов в Telegram-канале.',
    subscribe: 'Подписаться',
    aboutBlurb: 'Руководитель финансового планирования и анализа. Смотрю на компании как на модели: что в них заложено и что можно проверить.',
    more: 'Читать дальше →',
    job: 'Руководитель финансового планирования и анализа',
    disclaimer: 'Материалы носят информационный характер и не являются инвестиционной рекомендацией. Инвестиции связаны с риском потери капитала.',
    siteDesc: 'Независимая инвестиционная аналитика: разборы компаний, рынков и исторических аналогий с источниками и оговорками.',
    blogDesc: 'Все материалы блога: рынки, компании, история.',
    nf: 'Такой страницы нет.', toHome: 'На главную', photoAlt: 'Фото: Oleksandr Nosikov',
    video: 'Видео', videoDesc: 'Видеоразборы компаний и рынков с канала на YouTube.', latestVideo: 'Последние видео', allVideo: 'Все видео →', play: 'Воспроизвести видео', noVideo: 'Видео появится здесь после публикации', watchOn: 'Смотреть также на YouTube', timecodes: 'Содержание',
  },
};

const NAME = cfg.name;
const pref = (l) => (l === DEFAULT ? '' : `/${l}`);
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const readMin = (t) => Math.max(1, Math.round(t.split(/\s+/).length / 200));

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

// --- иконки соцсетей (простые линейные, при желании замените на фирменные)
const ICONS = {
  telegram: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/><path d="m9 13 12-9"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
  youtube: '<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="m10 9.5 5 2.5-5 2.5z"/>',
  threads: '<path d="M16.5 8.5A5 5 0 0 0 12 6c-3 0-5 2.2-5 6s2 6 5 6c2.6 0 4.3-1.4 4.3-3.3 0-2-1.7-3-4.3-3-1.6 0-2.7.7-2.7 1.8 0 1 .9 1.7 2.1 1.7 1.9 0 3-1.2 3-3.6V9"/>',
};
const LABEL = { telegram: 'Telegram', instagram: 'Instagram', threads: 'Threads', youtube: 'YouTube' };
const socials = ['youtube', 'instagram', 'threads', 'telegram'].filter((k) => cfg.links[k]).map((k) => ({ key: k, label: LABEL[k], url: cfg.links[k] }));
const icon = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
const socialLinks = (withText = false) => socials.map((s) => `<a class="soc" href="${esc(s.url)}" rel="noopener me" aria-label="${s.label}"${withText ? '' : ` title="${s.label}"`}>${icon(s.key)}${withText ? `<span>${s.label}</span>` : ''}</a>`).join('');

// --- читаем контент
const content = {};
const exists = {};
for (const l of LANGS) {
  const dir = path.join(root, 'content', l, 'posts');
  const posts = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
        const { meta, body } = parseMd(path.join(dir, f));
        const slug = meta.slug || f.replace(/\.md$/, '');
        return { ...meta, slug, body, html: marked.parse(body), minutes: readMin(body), path: `/posts/${slug}/` };
      }).filter((p) => showDrafts || !p.draft).sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];
  const about = parseMd(path.join(root, 'content', l, 'about.md'));
  const vdir = path.join(root, 'content', l, 'videos');
  const videos = fs.existsSync(vdir)
    ? fs.readdirSync(vdir).filter((f) => f.endsWith('.md')).map((f) => {
        const { meta, body } = parseMd(path.join(vdir, f));
        const slug = meta.slug || f.replace(/\.md$/, '');
        const id = String(meta.videoId || '').replace(/[^A-Za-z0-9_-]/g, '');
        return { ...meta, slug, id, html: marked.parse(body), path: `/video/${slug}/` };
      }).filter((v) => showDrafts || !v.draft).sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];
  content[l] = { posts, about, videos };
  exists[l] = new Set(['/', '/analitika/', '/ob-avtore/', ...posts.map((p) => p.path), ...(videos.length ? ['/video/', ...videos.map((v) => v.path)] : [])]);
}

const write = (rel, data) => {
  const f = path.join(out, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
};

// --- каркас страницы
function layout(l, { title, description, path: p, body, hero = '', ld = [], type = 'website', current = '', noindex = false, single = false }) {
  const t = T[l];
  const full = title === NAME ? NAME : `${title} | ${NAME}`;
  const canonical = base + pref(l) + p;
  const alts = single ? [] : LANGS.filter((x) => exists[x].has(p));
  const nav = (href, label, key) => `<a href="${pref(l)}${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const switcher = single ? '' : `<div class="lang" role="group" aria-label="${t.langLabel}">${LANGS.map((x) => {
    const href = pref(x) + (exists[x].has(p) ? p : '/');
    return `<a href="${href}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="true"' : ''}>${T[x].label}</a>`;
  }).join('')}</div>`;
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${alts.map((x) => `<link rel="alternate" hreflang="${x}" href="${base + pref(x) + p}">`).join('\n')}
${alts.length ? `<link rel="alternate" hreflang="x-default" href="${base + pref(DEFAULT) + p}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${t.locale}">
<meta property="og:image" content="${base}/photo.jpg">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/photo.jpg">
<link rel="alternate" type="application/rss+xml" title="${esc(NAME)}" href="${pref(l)}/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${ld.map(jsonLd).join('\n')}
</head>
<body>
<a class="skip" href="#content">${t.skip}</a>
<div class="band-dark">
<div class="wrap">
<header class="top">
  <a class="logo" href="${pref(l)}/">${esc(NAME)}</a>
  <div class="tools">
    <nav class="main" aria-label="${t.menu}">
      ${nav('/', t.home, 'home')}
      ${nav('/analitika/', t.blog, 'blog')}
      ${content[l].videos.length ? nav('/video/', t.video, 'video') : ''}
      ${nav('/ob-avtore/', t.about, 'about')}
    </nav>
    ${socials.length ? `<div class="socials">${socialLinks()}</div>` : ''}
    ${switcher}
  </div>
</header>
</div>
${hero}
</div>
<main id="content">
${body}
</main>
<footer class="bottom">
<div class="wrap">
  ${socials.length ? `<div class="socials foot">${socialLinks(true)}</div>` : ''}
  <p>${esc(t.disclaimer)}</p>
  <p>© ${new Date().getFullYear()} ${esc(NAME)}</p>
</div>
</footer>
</body>
</html>`;
}

const fmtDate = (l, d) => new Date(d).toLocaleDateString(T[l].dates, { day: 'numeric', month: 'long', year: 'numeric' });
const row = (l, p) => `<article class="entry">
  <div class="entry-meta">${fmtDate(l, p.date)}${p.category ? ' · ' + esc(p.category) : ''} · ${p.minutes} ${T[l].min}</div>
  <h3><a href="${pref(l)}${p.path}">${esc(p.title)}</a></h3>
  <p>${esc(p.description || '')}</p>
</article>`;
const list = (l, items) => (items.length ? `<div class="entries">${items.map((p) => row(l, p)).join('')}</div>` : `<p class="empty">${T[l].empty}</p>`);

const PLAY = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const thumbImg = (v) => (v.id ? `<img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy">` : '');
const vcard = (l, v) => `<a class="vcard" href="${pref(l)}${v.path}">
  <div class="vthumb">${thumbImg(v)}<span class="play">${PLAY}</span>${v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ''}</div>
  <div class="entry-meta">${fmtDate(l, v.date)}${v.category ? ' · ' + esc(v.category) : ''}</div>
  <h3>${esc(v.title)}</h3>
  <p>${esc(v.description || '')}</p>
</a>`;
const videoBlock = (l) => {
  const vs = content[l].videos;
  if (!vs.length) return '';
  return `<section class="wrap video-home" aria-labelledby="vh"><div class="sec-row"><h2 class="section-title" id="vh">${T[l].latestVideo}</h2><a href="${pref(l)}/video/">${T[l].allVideo}</a></div><div class="vgrid">${vs.slice(0, 3).map((v) => vcard(l, v)).join('')}</div></section>`;
};
const isoDur = (d = '') => { const m = String(d).match(/^(?:(\d+):)?(\d+):(\d+)$/); if (!m) return ''; return `PT${m[1] ? m[1] + 'H' : ''}${+m[2]}M${+m[3]}S`; };

let nlId = 0;
function signup(l) {
  const t = T[l];
  const id = `nl${++nlId}`;
  if (cfg.links.newsletter) return `<section class="signup" aria-labelledby="${id}"><div class="narrow">
  <h2 id="${id}">${t.signupTitle}</h2><p>${t.signupForm}</p>
  <form action="${esc(cfg.links.newsletter)}" method="post">
    <label class="sr" for="${id}e">Email</label>
    <input id="${id}e" name="email" type="email" placeholder="you@email.com" required>
    <button type="submit">${t.subscribe}</button>
  </form></div></section>`;
  if (cfg.links.telegram) return `<section class="signup" aria-labelledby="${id}"><div class="narrow">
  <h2 id="${id}">${t.signupTitle}</h2><p>${t.signupTg}</p>
  <a class="btn" href="${esc(cfg.links.telegram)}" rel="noopener">${t.subTg}</a></div></section>`;
  return '';
}

const sameAs = socials.map((s) => s.url).filter((u) => /^https?:/.test(u));
const person = (l) => ({ '@type': 'Person', '@id': `${base}/#author`, name: NAME, jobTitle: T[l].job, url: `${base}${pref(l)}/ob-avtore/`, image: `${base}/photo.jpg`, sameAs });

// --- сборка
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'style.css'), path.join(out, 'style.css'));
const staticDir = path.join(root, 'static');
if (fs.existsSync(staticDir)) fs.cpSync(staticDir, out, { recursive: true });

const sitemapEntries = new Map();
const addSitemap = (p) => sitemapEntries.set(p, LANGS.filter((x) => exists[x].has(p)));

for (const l of LANGS) {
  const t = T[l];
  const { posts, about, videos } = content[l];
  const P = pref(l);
  const tgBtn = cfg.links.telegram ? `<a class="btn outline" href="${esc(cfg.links.telegram)}" rel="noopener">${t.subTg}</a>` : '';

  // главная
  write(`${P}/index.html`.replace(/^\//, ''), layout(l, {
    title: NAME, description: t.siteDesc, path: '/', current: 'home',
    ld: [{ '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', '@id': `${base}/#site`, url: `${base}${P}/`, name: NAME, description: t.siteDesc, inLanguage: t.htmlLang, publisher: { '@id': `${base}/#author` } },
      person(l),
    ] }],
    hero: `<section class="hero"><div class="narrow">
  <h1>${esc(NAME)}</h1>
  <h2>${t.heroSub}</h2>
  <div class="cta"><a class="btn yellow" href="${P}/analitika/">${t.read}</a>${tgBtn}</div>
</div></section>`,
    body: `<div class="narrow">
<h2 class="section-title">${t.latest}</h2>
${list(l, posts.slice(0, 5))}
${posts.length ? `<p class="more"><a href="${P}/analitika/">${t.all}</a></p>` : ''}
</div>
${videoBlock(l)}
${signup(l)}
<div class="narrow">
<section class="about-strip" aria-labelledby="ab">
  <img class="avatar" src="/photo.jpg" width="140" height="140" alt="${t.photoAlt}">
  <div><h2 id="ab">${t.about}</h2>
  <p>${esc(NAME)}. ${t.aboutBlurb}</p>
  <a href="${P}/ob-avtore/">${t.more}</a></div>
</section>
</div>`,
  }));

  // список статей
  write(`${P}/analitika/index.html`.replace(/^\//, ''), layout(l, {
    title: t.blog, description: t.blogDesc, path: '/analitika/', current: 'blog',
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: t.blog, url: `${base}${P}/analitika/`, inLanguage: t.htmlLang }],
    body: `<div class="narrow">
<div class="crumbs"><a href="${P}/">${t.home}</a> / ${t.blog}</div>
<h1 class="page-title">${t.blog}</h1>
${list(l, posts)}
</div>
${signup(l)}`,
  }));

  // статьи
  for (const p of posts) {
    const url = `${base}${P}${p.path}`;
    write(`${P}${p.path}index.html`.replace(/^\//, ''), layout(l, {
      title: p.title, description: p.description || t.siteDesc, path: p.path, type: 'article', current: 'blog', noindex: !!p.draft,
      ld: [
        { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description || '', datePublished: p.date, dateModified: p.updated || p.date, inLanguage: t.htmlLang, mainEntityOfPage: url, author: { '@id': `${base}/#author` }, publisher: { '@id': `${base}/#author` } },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: `${base}${P}/` },
          { '@type': 'ListItem', position: 2, name: t.blog, item: `${base}${P}/analitika/` },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ] },
        { '@context': 'https://schema.org', ...person(l) },
      ],
      body: `<div class="narrow">
<div class="crumbs"><a href="${P}/">${t.home}</a> / <a href="${P}/analitika/">${t.blog}</a></div>
<article class="post">
  <div class="meta">${esc(p.category || '')}${p.category ? ' · ' : ''}${fmtDate(l, p.date)} · ${p.minutes} ${t.min}</div>
  <h1>${esc(p.title)}</h1>
  ${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}
  <div class="prose">${p.html}</div>
</article>
</div>
${signup(l)}`,
    }));
  }

  // об авторе
  write(`${P}/ob-avtore/index.html`.replace(/^\//, ''), layout(l, {
    title: t.about, description: about.meta.description || `${NAME}: ${t.job}.`, path: '/ob-avtore/', current: 'about',
    ld: [{ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: person(l) }],
    body: `<div class="narrow"><article class="post">
  <img class="avatar big" src="/photo.jpg" width="200" height="200" alt="${t.photoAlt}">
  <h1>${t.about}</h1><div class="prose">${marked.parse(about.body)}</div>
</article></div>
${signup(l)}`,
  }));

  // видео: каталог и страницы
  if (videos.length) {
    write(`${P}/video/index.html`.replace(/^\//, ''), layout(l, {
      title: t.video, description: t.videoDesc, path: '/video/', current: 'video',
      ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: t.video, url: `${base}${P}/video/`, inLanguage: t.htmlLang }],
      body: `<div class="wrap">
<div class="crumbs"><a href="${P}/">${t.home}</a> / ${t.video}</div>
<h1 class="page-title">${t.video}</h1>
<div class="vgrid" style="padding:32px 0 64px">${videos.map((v) => vcard(l, v)).join('')}</div>
</div>
${signup(l)}`,
    }));
    for (const v of videos) {
      const url = `${base}${P}${v.path}`;
      const ld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: `${base}${P}/` },
        { '@type': 'ListItem', position: 2, name: t.video, item: `${base}${P}/video/` },
        { '@type': 'ListItem', position: 3, name: v.title, item: url },
      ] }];
      if (v.id) ld.push({ '@context': 'https://schema.org', '@type': 'VideoObject', name: v.title, description: v.description || v.title, thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, uploadDate: v.date, embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`, ...(isoDur(v.duration) ? { duration: isoDur(v.duration) } : {}), inLanguage: t.htmlLang });
      const player = v.id
        ? `<div class="player" data-id="${v.id}" data-title="${esc(v.title)}">${thumbImg(v)}<button class="play-btn" type="button" aria-label="${t.play}"><span class="play">${PLAY}</span></button></div>
<script>document.querySelectorAll('.player[data-id]').forEach(function(p){p.querySelector('button').addEventListener('click',function(){p.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+p.dataset.id+'?autoplay=1&rel=0" title="'+p.dataset.title+'" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';});});</script>`
        : `<div class="player empty"><span class="play">${PLAY}</span><p>${t.noVideo}</p></div>`;
      write(`${P}${v.path}index.html`.replace(/^\//, ''), layout(l, {
        title: v.title, description: v.description || t.videoDesc, path: v.path, type: 'video.other', current: 'video', noindex: !!v.draft, ld,
        body: `<div class="narrow">
<div class="crumbs"><a href="${P}/">${t.home}</a> / <a href="${P}/video/">${t.video}</a></div>
<article class="post">
  <div class="meta">${esc(v.category || '')}${v.category ? ' · ' : ''}${fmtDate(l, v.date)}${v.duration ? ' · ' + esc(v.duration) : ''}</div>
  <h1>${esc(v.title)}</h1>
  ${player}
  <div class="prose">${v.html}</div>
</article>
</div>
${signup(l)}`,
      }));
    }
  }

  // RSS
  write(`${P}/rss.xml`.replace(/^\//, ''), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(NAME)}</title><link>${base}${P}/</link><description>${esc(t.siteDesc)}</description><language>${t.htmlLang}</language>\n${posts.filter((p) => !p.draft).map((p) => `<item><title>${esc(p.title)}</title><link>${base}${P}${p.path}</link><guid>${base}${P}${p.path}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.description || '')}</description></item>`).join('\n')}\n</channel></rss>\n`);

  for (const p of ['/', '/analitika/', '/ob-avtore/', ...posts.filter((x) => !x.draft).map((x) => x.path), ...(videos.length ? ['/video/', ...videos.filter((x) => !x.draft).map((x) => x.path)] : [])]) addSitemap(p);
}

// 404 (один на сайт, на языке по умолчанию)
write('404.html', layout(DEFAULT, {
  title: '404', description: T[DEFAULT].nf, path: '/404.html', noindex: true, single: true,
  body: `<div class="narrow" style="text-align:center;padding:72px 32px"><h1 class="page-title">404</h1><p>${T[DEFAULT].nf}</p><p><a class="btn yellow" href="/">${T[DEFAULT].toHome}</a></p></div>`,
}));

write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...sitemapEntries].flatMap(([p, ls]) => ls.map((l) => `  <url><loc>${base}${pref(l)}${p}</loc>${ls.length > 1 ? ls.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${base}${pref(x)}${p}"/>`).join('') : ''}</url>`)).join('\n')}\n</urlset>\n`);

console.log(`Готово: ${LANGS.map((l) => `${l}: ${content[l].posts.length} статей`).join(', ')}${showDrafts ? ' (с черновиками)' : ''} -> dist/`);
