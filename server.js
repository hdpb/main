const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const RIGHTMOVE_BASE_URL = 'https://www.rightmove.co.uk/property-for-sale/find.html';
const RIGHTMOVE_HOST = 'https://www.rightmove.co.uk';

// TODO: Adjust the default location mapping here if you want more accurate Rightmove location identifiers.
const DEFAULT_LOCATION = 'Southend-on-Sea';

const normalizeList = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const extractNumber = (text) => {
  if (!text) return null;
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return Number.parseInt(digits, 10);
};

const inferBedrooms = (text) => {
  if (!text) return null;
  const match = text.match(/(\d+)\s*bed/i);
  return match ? Number.parseInt(match[1], 10) : null;
};

const inferType = (text) => {
  if (!text) return null;
  const match = text.match(/(flat|apartment|house|studio|bungalow|maisonette|duplex|terrace|detached|semi-detached|semi detached|townhouse)/i);
  return match ? match[1].replace(/\bsemi\b/i, 'Semi-') : null;
};

const buildRightmoveSearchUrl = ({
  location = DEFAULT_LOCATION,
  minPrice,
  maxPrice,
  minBeds,
  maxBeds,
}) => {
  // TODO: Update this function if you want to use Rightmove's official location identifiers or add more filters.
  const params = new URLSearchParams({
    searchType: 'SALE',
    searchLocation: location,
  });

  if (minPrice) params.set('minPrice', minPrice);
  if (maxPrice) params.set('maxPrice', maxPrice);
  if (minBeds) params.set('minBedrooms', minBeds);
  if (maxBeds) params.set('maxBedrooms', maxBeds);

  return `${RIGHTMOVE_BASE_URL}?${params.toString()}`;
};

const makeAbsoluteUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${RIGHTMOVE_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
};

async function fetchRightmoveListings(searchUrl) {
  // IMPORTANT: This scraping code is an example. Before using it against Rightmove or any website in production,
  // check and comply with their terms of use, robots.txt, and apply respectful rate limiting.
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; RightmoveScanner/1.0; +https://localhost)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch listings: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    try {
      // If Rightmove changes their HTML structure, update the selectors below.
      $('.propertyCard, .l-searchResult').each((_, element) => {
        const card = $(element);
        const title =
          card.find('.propertyCard-title').text().trim() ||
          card.find('h2').first().text().trim();
        const address =
          card.find('.propertyCard-address').text().trim() ||
          card.find('.propertyCard-address span').text().trim();
        const priceText =
          card.find('.propertyCard-priceValue').text().trim() ||
          card.find('.propertyCard-priceValue span').text().trim();
        const price = extractNumber(priceText);

        const summaryText =
          card.find('.propertyCard-summary').text().trim() ||
          card.find('.property-information').text().trim() ||
          '';

        const bedrooms = inferBedrooms(summaryText) ?? inferBedrooms(title);
        const type = inferType(summaryText) ?? inferType(title);

        const link =
          card.find('a.propertyCard-link').attr('href') ||
          card.find('a').first().attr('href');
        const url = makeAbsoluteUrl(link);

        const imageUrl =
          card.find('img.propertyCard-img').attr('data-src') ||
          card.find('img.propertyCard-img').attr('src') ||
          card.find('img').first().attr('src');

        results.push({
          title: title || summaryText || 'Property listing',
          address: address || 'Address unavailable',
          price,
          priceText: priceText || 'Price on request',
          bedrooms,
          type,
          url,
          imageUrl,
        });
      });
    } catch (parseError) {
      throw new Error(`Parsing failed: ${parseError.message}`);
    }

    return results;
  } catch (error) {
    throw new Error(`Rightmove fetch failed: ${error.message}`);
  }
}

app.get('/api/search', async (req, res) => {
  const {
    location,
    minPrice,
    maxPrice,
    minBeds,
    maxBeds,
    keywords,
    excludeWords,
  } = req.query;

  const searchUrl = buildRightmoveSearchUrl({
    location,
    minPrice,
    maxPrice,
    minBeds,
    maxBeds,
  });

  try {
    const listings = await fetchRightmoveListings(searchUrl);
    const keywordList = normalizeList(keywords).map((word) => word.toLowerCase());
    const excludeList = normalizeList(excludeWords).map((word) => word.toLowerCase());

    const filtered = listings.filter((listing) => {
      const title = (listing.title || '').toLowerCase();
      const address = (listing.address || '').toLowerCase();
      const type = (listing.type || '').toLowerCase();

      if (minPrice && listing.price && listing.price < Number(minPrice)) {
        return false;
      }
      if (maxPrice && listing.price && listing.price > Number(maxPrice)) {
        return false;
      }
      if (minBeds && listing.bedrooms && listing.bedrooms < Number(minBeds)) {
        return false;
      }
      if (maxBeds && listing.bedrooms && listing.bedrooms > Number(maxBeds)) {
        return false;
      }

      if (keywordList.length > 0) {
        const matchesKeyword = keywordList.some((word) =>
          [title, address, type].some((field) => field.includes(word))
        );
        if (!matchesKeyword) return false;
      }

      if (excludeList.length > 0) {
        const hasExcluded = excludeList.some((word) =>
          [title, address].some((field) => field.includes(word))
        );
        if (hasExcluded) return false;
      }

      return true;
    });

    res.json({
      searchUrl,
      total: filtered.length,
      results: filtered,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch listings. The website structure might have changed.',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Rightmove Property Scanner running at http://localhost:${PORT}`);
});
