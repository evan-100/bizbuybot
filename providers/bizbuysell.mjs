import { htmlToText, normalizePrice } from '../lib/scraper.mjs';

function absolutize(href, baseUrl) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) {
    const m = baseUrl.match(/^(https?:\/\/[^/]+)/);
    return m ? m[1] + href : href;
  }
  return href;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/gi, ' ');
}

function tagText(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const STATE_NAMES = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca',
  colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga',
  hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks',
  kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma',
  michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt',
  nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
  'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd',
  ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri',
  'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx',
  utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv',
  wisconsin: 'wi', wyoming: 'wy',
};

export function extractLocation(terms) {
  const q = terms.toLowerCase();
  let st = null;
  let stateName = null;
  let stateIdx = -1;
  for (const [name, postal] of Object.entries(STATE_NAMES)) {
    const nameMatch = q.match(new RegExp(`\\b${name}\\b`));
    const postalMatch = q.match(new RegExp(`\\b${postal}\\b`));
    if (nameMatch || postalMatch) {
      const m = nameMatch || postalMatch;
      st = postal;
      stateName = name;
      stateIdx = m.index;
      break;
    }
  }
  // City words live AFTER the sale marker ("... for sale Orlando Florida");
  // words before it are category terms ("laundromat for sale Texas").
  let city = null;
  const saleMarker = Math.max(q.lastIndexOf('sale'), q.lastIndexOf('sell'));
  if (stateIdx > 0 && saleMarker >= 0 && saleMarker < stateIdx) {
    let rest = q.slice(saleMarker + 4, stateIdx).trim();
    rest = rest.replace(/^(?:in|near|around)\s+/, '');
    rest = rest.replace(/[\s,-]+$/, '');
    if (rest) {
      const words = rest.split(/\s+/).filter(Boolean).slice(0, 3);
      if (words.length) city = words.join('-');
    }
  }
  return { city, st, stateName };
}

export default {
  id: 'bizbuysell',

  buildSearchUrl(terms) {
    const { city, st, stateName } = extractLocation(terms.replace(/\bsite:bizbuysell\.com\s*/i, ''));
    if (st && city) return `https://www.bizbuysell.com/${stateName}-businesses-for-sale/${city}/`;
    if (st) return `https://www.bizbuysell.com/${stateName}-businesses-for-sale/`;
    return 'https://www.bizbuysell.com/businesses-for-sale/';
  },

  parseSearchResults(html, url) {
    const listings = [];
    if (!html) return listings;

    const cards = html.split(/<app-listing-diamond[\s>]/).slice(1);
    for (const card of cards) {
      const hrefMatch = card.match(/href="([^"]*\/business-opportunity\/[^"]+)"/i);
      if (!hrefMatch) continue;

      const fullUrl = absolutize(hrefMatch[1], url);

      let title = null;
      const titleEl = card.match(/<(?:span|h3)[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/(?:span|h3)>/i);
      if (titleEl) {
        title = tagText(titleEl[1]);
      } else {
        const attrMatch = card.match(/title="([^"]+)"/i);
        if (attrMatch) title = decodeEntities(attrMatch[1]);
      }
      if (!title) continue;

      const locEl = card.match(/<p[^>]*class="[^"]*\blocation\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const location = locEl ? tagText(locEl[1]).replace(/\s+,/g, ',') : null;

      const priceEl = card.match(/<p[^>]*class="[^"]*asking-price[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const price = priceEl ? normalizePrice(tagText(priceEl[1])) : null;

      let sde = null;
      const cfMatches = [...card.matchAll(/<p[^>]*class="[^"]*cash-flow[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)];
      for (const cf of cfMatches) {
        const cfText = tagText(cf[1]);
        if (!cfText || /sign in|log in|view profit/i.test(cfText)) continue;
        const num = cfText.match(/\$[\d,.]+\s*[KkMm]?/);
        if (num) {
          sde = normalizePrice(num[0]);
          break;
        }
      }

      const descEl = card.match(/<p[^>]*class="[^"]*\bdescription\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

      listings.push({
        title,
        price,
        sde,
        revenue: null,
        location,
        description: descEl ? tagText(descEl[1]) : null,
        category: null,
        url: fullUrl,
        source: 'bizbuysell',
      });
    }

    return listings;
  },

  parseListing(content, url) {
    if (!content) return null;

    // Check if this is HTML search results
    if (typeof content === 'string' && content.includes('listing-card')) {
      const results = this.parseSearchResults(content, url);
      if (results.length > 0) return results[0];
    }

    const text = typeof content === 'string' ? content : '';

    // Price extraction
    const priceMatch = text.match(/Asking Price:?\s*<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                       text.match(/Asking Price:?\s*<\/b>\s*([^<]+)/i) ||
                       text.match(/<span[^>]*class="[^"]*asking-price[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                       text.match(/Asking Price:?\s*\n*\s*\$?([\d,]+(?:\.\d+)?)/i);

    // Cash flow / SDE extraction
    const sdeMatch = text.match(/Cash Flow:?\s*<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                     text.match(/Cash Flow:?\s*<\/b>\s*([^<]+)/i) ||
                     text.match(/Cash Flow(?:\s*\(SDE\))?:?\s*\n*\s*\$?([\d,]+(?:\.\d+)?)/i) ||
                     text.match(/SDE:?\s*<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                     text.match(/SDE:?\s*\n*\s*\$?([\d,]+(?:\.\d+)?)/i);

    // Gross revenue extraction
    const revMatch = text.match(/Gross Revenue:?\s*<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                     text.match(/Gross Revenue:?\s*<\/b>\s*([^<]+)/i) ||
                     text.match(/Gross Revenue:?\s*\n*\s*\$?([\d,]+(?:\.\d+)?)/i);

    // Location extraction
    let location = null;
    const locHtmlMatch = text.match(/Location:?\s*<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                         text.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                         text.match(/Location:?\s*<\/b>\s*([^<]+)/i);
    if (locHtmlMatch && locHtmlMatch[1]) {
      location = locHtmlMatch[1].trim();
    } else {
      const locTextMatch = text.match(/\nLocation:?\s*\n+([A-Za-z0-9\s,.-]+(?:,\s*[A-Z]{2})?)/i);
      if (locTextMatch && locTextMatch[1].trim().length > 2 && !locTextMatch[1].includes('Search')) {
        location = locTextMatch[1].trim();
      } else {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const askingIdx = lines.findIndex(l => /^asking price:?/i.test(l));
        if (askingIdx >= 1) {
          const prev = lines[askingIdx - 1];
          if (/, [A-Z]{2}$/i.test(prev) || /County/i.test(prev)) {
            location = prev;
          }
        }
      }
    }

    // Category extraction
    const catMatch = text.match(/(?:Business\s+)?Category:?\s*<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                     text.match(/<span[^>]*class="[^"]*category[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                     text.match(/(?:Business\s+)?Category:?\s*<\/b>\s*([^<]+)/i);

    // Description extraction
    const descMatch = text.match(/<div[^>]*class="[^"]*(?:business-)?description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      text.match(/<div[^>]*id="[^"]*listing-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      text.match(/<h2>Business Description<\/h2>\s*<p>([\s\S]*?)<\/p>/i) ||
                      text.match(/Business Description\s*\n+([\s\S]*?)(?=\n+[A-Z][a-zA-Z\s]+:|\n+Detailed Information|\n+Contact Broker|$)/i);

    let title = null;

    // HTML title tags
    const htmlTitleMatch = text.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                           text.match(/<title>([^<|]+)(?:\|.*)?<\/title>/i);
    if (htmlTitleMatch && htmlTitleMatch[1].trim()) {
      title = htmlTitleMatch[1].trim();
      title = title.replace(/\s+in\s+[^,]+,\s*[A-Za-z\s]+-\s*BizBuySell$/i, '').trim();
    }

    // Text layout extraction for title
    if (!title) {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const askingIdx = lines.findIndex(l => /^asking price:?/i.test(l));
      if (askingIdx >= 2) {
        title = lines[askingIdx - 2];
      } else if (askingIdx === 1) {
        title = lines[0];
      } else if (lines.length > 0) {
        title = lines[0];
      }
    }

    if (!title) return null;

    const description = descMatch ? htmlToText(descMatch[1]) : null;

    return {
      title: title.trim(),
      price: priceMatch ? normalizePrice(priceMatch[1].trim()) : null,
      sde: sdeMatch ? normalizePrice(sdeMatch[1].trim()) : null,
      revenue: revMatch ? normalizePrice(revMatch[1].trim()) : null,
      location: location ? location.replace(/<[^>]+>/g, '').trim() : null,
      description: description || null,
      category: catMatch ? catMatch[1].replace(/<[^>]+>/g, '').trim() : null,
      url,
      source: 'bizbuysell',
    };
  },
};
