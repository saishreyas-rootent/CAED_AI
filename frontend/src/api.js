const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res;
}

export const api = {
  async getPdfInfo(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await request('/pdf/info', { method: 'POST', body: fd });
    return res.json();
  },

  async getPdfPreview(file, page = 1) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('page', page);
    const res = await request('/pdf/preview', { method: 'POST', body: fd });
    return res.json();
  },

  async convertPdf(files, options) {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('options', JSON.stringify(options));
    const res = await request('/pdf/convert', { method: 'POST', body: fd });
    return res.blob();
  },

  async getRasterPreview(file, threshold, invert) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('threshold', threshold);
    fd.append('invert', invert);
    const res = await request('/raster/preview', { method: 'POST', body: fd });
    return res.json();
  },

  async convertRaster(file, threshold, invert, layerName) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('threshold', threshold);
    fd.append('invert', invert);
    fd.append('layer_name', layerName);
    const res = await request('/raster/convert', { method: 'POST', body: fd });
    return res.blob();
  },
};