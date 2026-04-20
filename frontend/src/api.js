const API_BASE = '/api';

export const api = {
  health: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  getPdfInfo: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/pdf/info`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to get PDF info');
    return res.json();
  },

  getPdfPreview: async (file, pageNum, scale = 2.0) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('page_num', pageNum);
    formData.append('scale', scale);
    const res = await fetch(`${API_BASE}/pdf/preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to get preview');
    return res.json();
  },

  convertPdf: async (files, options) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('include_geom', options.includeGeom);
    formData.append('include_text', options.includeText);
    formData.append('skip_curves', options.skipCurves);
    formData.append('min_size', options.minSize);
    formData.append('page_from', options.pageFrom);
    formData.append('page_to', options.pageTo);
    if (options.cropRect) {
      formData.append('crop_rect', JSON.stringify(options.cropRect));
    }

    const res = await fetch(`${API_BASE}/pdf/convert`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Conversion failed');
    return res.blob();
  },

  getRasterPreview: async (file, threshold, invert) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('threshold', threshold);
    formData.append('invert', invert);
    const res = await fetch(`${API_BASE}/raster/preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Raster preview failed');
    return res.json();
  },

  convertRaster: async (file, threshold, invert, layerName) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('threshold', threshold);
    formData.append('invert', invert);
    formData.append('layer_name', layerName);

    const res = await fetch(`${API_BASE}/raster/convert`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Raster conversion failed');
    return res.blob();
  }
};
