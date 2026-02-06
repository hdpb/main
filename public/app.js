document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const resultsContainer = document.getElementById('results');
  const summary = document.getElementById('results-summary');
  const searchUrlField = document.getElementById('search-url');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');

  const formatPrice = (value, fallback) => {
    if (!value) return fallback || 'Price on request';
    return `£${Number(value).toLocaleString('en-GB')}`;
  };

  const safeText = (text, fallback) => (text ? text : fallback);

  const setLoading = (isLoading) => {
    loading.classList.toggle('status--hidden', !isLoading);
  };

  const setError = (message) => {
    error.textContent = message || '';
  };

  const renderEmpty = (message) => {
    resultsContainer.innerHTML = `<div class="empty-state">${message}</div>`;
  };

  const renderResults = (results) => {
    if (!results.length) {
      renderEmpty('No matches found for that criteria.');
      return;
    }

    resultsContainer.innerHTML = results
      .map((listing) => {
        const image = listing.imageUrl || 'https://via.placeholder.com/600x400?text=No+Image';
        const beds = listing.bedrooms ? `${listing.bedrooms} beds` : 'Beds: n/a';
        const type = listing.type ? listing.type : 'Type: n/a';

        return `
          <article class="property-card">
            <img src="${image}" alt="${safeText(listing.title, 'Property image')}" />
            <div class="price">${formatPrice(listing.price, listing.priceText)}</div>
            <div class="title">${safeText(listing.title, 'Property listing')}</div>
            <div class="meta">${safeText(listing.address, 'Address unavailable')}</div>
            <div class="meta">${beds} • ${type}</div>
            <a href="${listing.url || '#'}" target="_blank" rel="noopener noreferrer">
              View on Rightmove
            </a>
          </article>
        `;
      })
      .join('');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    summary.textContent = 'Scanning listings...';

    const formData = new FormData(form);
    const params = new URLSearchParams();
    formData.forEach((value, key) => {
      if (value) params.set(key, value.toString());
    });

    try {
      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unexpected error');
      }

      searchUrlField.value = data.searchUrl || '';
      summary.textContent = `Showing ${data.total} matching properties`;
      renderResults(data.results || []);
    } catch (err) {
      setError(err.message || 'Something went wrong while scanning.');
      summary.textContent = 'Showing 0 matching properties';
      renderEmpty('Unable to load listings right now.');
    } finally {
      setLoading(false);
    }
  });
});
