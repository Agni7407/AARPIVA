const SITE_URL = 'https://aarpiva.com';
const API_URL = 'https://aarpiva-api.onrender.com/api';
const CACHE_SECONDS = 900;

function isActiveRecord(record) {
  return record && record.isActive === true && Number.isSafeInteger(record.id) && record.id > 0;
}

async function getActiveRecords(path) {
  const response = await fetch(`${API_URL}/${path}`);
  if (!response.ok) throw new Error(`Public ${path} API returned ${response.status}`);

  const records = await response.json();
  if (!Array.isArray(records)) throw new Error(`Public ${path} API returned an invalid response`);
  return records.filter(isActiveRecord);
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

function sitemapXml(urls) {
  const entries = [...urls].map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export async function onRequest({ request }) {
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(new URL('/sitemap.xml', request.url));
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const urls = new Set([`${SITE_URL}/`, `${SITE_URL}/products`]);

  try {
    const [categories, products] = await Promise.all([
      getActiveRecords('categories'),
      getActiveRecords('products')
    ]);

    for (const category of categories) {
      urls.add(`${SITE_URL}/products?categoryId=${category.id}`);
    }
    for (const product of products) {
      urls.add(`${SITE_URL}/products/${product.id}`);
    }
  } catch (error) {
    console.error('Could not load the public catalogue for the sitemap.', error);
    return new Response('Sitemap temporarily unavailable.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  const response = new Response(sitemapXml(urls), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff'
    }
  });

  if (cache) await cache.put(cacheKey, response.clone());
  return response;
}