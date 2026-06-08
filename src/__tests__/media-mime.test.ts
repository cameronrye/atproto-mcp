/**
 * Regression test: link-preview thumbnails must only be uploaded with a validated
 * image MIME type. Previously the remote server's Content-Type header was passed
 * straight to uploadBlob, so a non-image response could be stored as a blob.
 */

import { describe, it, expect } from 'vitest';
import { safeImageMime } from '../tools/implementations/media-tools.js';

describe('safeImageMime', () => {
  it('accepts known image content types (normalized)', () => {
    expect(safeImageMime('image/jpeg')).toBe('image/jpeg');
    expect(safeImageMime('image/png')).toBe('image/png');
    expect(safeImageMime('image/gif')).toBe('image/gif');
    expect(safeImageMime('image/webp')).toBe('image/webp');
    // case-insensitive + strips parameters
    expect(safeImageMime('IMAGE/WEBP')).toBe('image/webp');
    expect(safeImageMime('image/jpeg; charset=binary')).toBe('image/jpeg');
  });

  it('rejects non-image / missing content types', () => {
    expect(safeImageMime('text/html')).toBeNull();
    expect(safeImageMime('application/octet-stream')).toBeNull();
    expect(safeImageMime('')).toBeNull();
    expect(safeImageMime(null)).toBeNull();
    expect(safeImageMime(undefined)).toBeNull();
  });
});
