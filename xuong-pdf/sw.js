/* Scan - PDF service worker, phiên bản 20261025-1330 */
const VERSION = 'xuongpdf-20261026-0030';
const CORE = ["./", "index.html", "manifest.json", "fonts.css", "pdf.min.js", "pdf.worker.min.js", "pdf-lib.min.js", "icon-192.png", "favicon-32.png", "apple-touch-icon.png", "be-vietnam-pro-latin-400-normal.woff2", "be-vietnam-pro-latin-500-normal.woff2", "be-vietnam-pro-latin-600-normal.woff2", "be-vietnam-pro-latin-700-normal.woff2", "be-vietnam-pro-latin-ext-400-normal.woff2", "be-vietnam-pro-latin-ext-500-normal.woff2", "be-vietnam-pro-latin-ext-600-normal.woff2", "be-vietnam-pro-latin-ext-700-normal.woff2", "be-vietnam-pro-vietnamese-400-normal.woff2", "be-vietnam-pro-vietnamese-500-normal.woff2", "be-vietnam-pro-vietnamese-600-normal.woff2", "be-vietnam-pro-vietnamese-700-normal.woff2", "ibm-plex-mono-latin-400-normal.woff2", "ibm-plex-mono-latin-500-normal.woff2"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // chỉ dọn bộ nhớ đệm cũ của Scan - PDF; các ứng dụng khác cùng tên miền giữ nguyên
    for (const k of await caches.keys()) if (k.startsWith('xuongpdf-') && k !== VERSION && k !== 'xuongpdf-inbox') await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Android: nhận file được chia sẻ vào ứng dụng
  if (req.method === 'POST' && url.searchParams.has('share-target')) {
    e.respondWith((async () => {
      const form = await req.formData();
      const files = form.getAll('files').filter(f => f && typeof f !== 'string');
      const inbox = await caches.open('xuongpdf-inbox');
      for (const k of await inbox.keys()) await inbox.delete(k);
      await Promise.all(files.map((f, i) => inbox.put(new Request(`./__inbox__/${i}`),
        new Response(f, { headers: { 'x-name': encodeURIComponent(f.name || `file_${i + 1}`), 'content-type': f.type || 'application/octet-stream' } }))));
      return Response.redirect(new URL(`./?received=${files.length}`, self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // trang chính: lấy bản mới khi có mạng, mất mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VERSION);
        c.put('./', fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match('./')) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }
  // manifest và icon: luôn lấy bản mới từ mạng trước, để tên và icon cài đặt không bị kẹt bản cũ
  if (/\/(manifest\.json|icon-\d+\.png|maskable-\d+\.png|apple-touch-icon\.png|favicon-\d+\.png|shortcut-\d+\.png)$/.test(url.pathname)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'reload' });
        if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }
  // thư viện, phông, dữ liệu OCR: dùng bản đã lưu, chưa có thì tải rồi lưu lại
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit && req.cache !== 'reload') return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch (err) {
      return hit || Response.error();
    }
  })());
});
