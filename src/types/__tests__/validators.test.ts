/**
 * Tests for type validators and type guards
 */

import { describe, it, expect } from 'vitest';
import {
  validateDID,
  validateATURI,
  validateCID,
  validateNSID,
  isDID,
  isATURI,
  isCID,
  isNSID,
} from '../index.js';

describe('DID Validation', () => {
  describe('validateDID', () => {
    it('should validate correct DID format', () => {
      expect(validateDID('did:plc:abc123xyz')).toBe('did:plc:abc123xyz');
      expect(validateDID('did:web:example.com')).toBe('did:web:example.com');
      expect(validateDID('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK')).toBe(
        'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
      );
    });

    it('should reject empty or non-string values', () => {
      expect(() => validateDID('')).toThrow('DID must be a non-empty string');
      expect(() => validateDID(null as any)).toThrow('DID must be a non-empty string');
      expect(() => validateDID(undefined as any)).toThrow('DID must be a non-empty string');
    });

    it('should reject DIDs not starting with did:', () => {
      expect(() => validateDID('plc:abc123')).toThrow("Must start with 'did:'");
      expect(() => validateDID('invalid')).toThrow("Must start with 'did:'");
    });

    it('should reject DIDs with insufficient parts', () => {
      expect(() => validateDID('did:plc')).toThrow("Must be 'did:method:identifier'");
      expect(() => validateDID('did:')).toThrow("Must be 'did:method:identifier'");
    });
  });

  describe('isDID', () => {
    it('should return true for valid DIDs', () => {
      expect(isDID('did:plc:abc123')).toBe(true);
      expect(isDID('did:web:example.com')).toBe(true);
    });

    it('should return false for invalid DIDs', () => {
      expect(isDID('invalid')).toBe(false);
      expect(isDID('')).toBe(false);
      expect(isDID(null)).toBe(false);
      expect(isDID(undefined)).toBe(false);
      expect(isDID(123)).toBe(false);
    });
  });
});

describe('ATURI Validation', () => {
  describe('validateATURI', () => {
    it('should validate correct ATURI format', () => {
      const uri = 'at://did:plc:abc123/app.bsky.feed.post/xyz789';
      expect(validateATURI(uri)).toBe(uri);
    });

    it('should reject empty or non-string values', () => {
      expect(() => validateATURI('')).toThrow('ATURI must be a non-empty string');
      expect(() => validateATURI(null as any)).toThrow('ATURI must be a non-empty string');
    });

    it('should reject URIs not starting with at://', () => {
      expect(() => validateATURI('https://example.com')).toThrow("Must start with 'at://'");
      expect(() => validateATURI('did:plc:abc123')).toThrow("Must start with 'at://'");
    });

    it('should reject URIs with insufficient parts', () => {
      expect(() => validateATURI('at://did:plc:abc123')).toThrow(
        "Must be 'at://authority/collection/rkey'"
      );
      expect(() => validateATURI('at://did:plc:abc123/app.bsky.feed.post')).toThrow(
        "Must be 'at://authority/collection/rkey'"
      );
    });

    it('should reject URIs with empty segments', () => {
      expect(() => validateATURI('at://did:plc:abc123//xyz789')).toThrow('must all be non-empty');
    });
  });

  describe('isATURI', () => {
    it('should return true for valid ATURIs', () => {
      expect(isATURI('at://did:plc:abc123/app.bsky.feed.post/xyz789')).toBe(true);
    });

    it('should return false for invalid ATURIs', () => {
      expect(isATURI('invalid')).toBe(false);
      expect(isATURI('')).toBe(false);
      expect(isATURI(null)).toBe(false);
      expect(isATURI(123)).toBe(false);
    });
  });
});

describe('CID Validation', () => {
  describe('validateCID', () => {
    it('should validate correct CID format', () => {
      expect(validateCID('bafyreigbtj4x7ip5legnfznufuopl4sg4knzc2cof6duas4b3q2fy6swua')).toBe(
        'bafyreigbtj4x7ip5legnfznufuopl4sg4knzc2cof6duas4b3q2fy6swua'
      );
      expect(validateCID('bafkreiabcd1234')).toBe('bafkreiabcd1234');
    });

    it('should reject empty or non-string values', () => {
      expect(() => validateCID('')).toThrow('CID must be a non-empty string');
      expect(() => validateCID(null as any)).toThrow('CID must be a non-empty string');
    });

    it('should reject non-alphanumeric CIDs', () => {
      expect(() => validateCID('invalid-cid!')).toThrow('Must be alphanumeric');
      expect(() => validateCID('cid with spaces')).toThrow('Must be alphanumeric');
    });

    it('should reject CIDs that are too short', () => {
      expect(() => validateCID('abc')).toThrow('CID too short');
      expect(() => validateCID('short')).toThrow('CID too short');
    });
  });

  describe('isCID', () => {
    it('should return true for valid CIDs', () => {
      expect(isCID('bafyreigbtj4x7ip5legnfznufuopl4sg4knzc2cof6duas4b3q2fy6swua')).toBe(true);
      expect(isCID('bafkreiabcd1234')).toBe(true);
    });

    it('should return false for invalid CIDs', () => {
      expect(isCID('invalid')).toBe(false);
      expect(isCID('')).toBe(false);
      expect(isCID(null)).toBe(false);
      expect(isCID(123)).toBe(false);
    });
  });
});

describe('NSID Validation', () => {
  describe('validateNSID', () => {
    it('should validate correct NSID format', () => {
      expect(validateNSID('app.bsky.feed.post')).toBe('app.bsky.feed.post');
      expect(validateNSID('com.atproto.repo.createRecord')).toBe('com.atproto.repo.createRecord');
      expect(validateNSID('app.bsky.graph.follow')).toBe('app.bsky.graph.follow');
    });

    it('should reject empty or non-string values', () => {
      expect(() => validateNSID('')).toThrow('NSID must be a non-empty string');
      expect(() => validateNSID(null as any)).toThrow('NSID must be a non-empty string');
    });

    it('should reject NSIDs with insufficient segments', () => {
      expect(() => validateNSID('app.bsky')).toThrow('Must have at least 3 segments');
      expect(() => validateNSID('single')).toThrow('Must have at least 3 segments');
    });
  });

  describe('isNSID', () => {
    it('should return true for valid NSIDs', () => {
      expect(isNSID('app.bsky.feed.post')).toBe(true);
      expect(isNSID('com.atproto.repo.createRecord')).toBe(true);
    });

    it('should return false for invalid NSIDs', () => {
      expect(isNSID('invalid')).toBe(false);
      expect(isNSID('app.bsky')).toBe(false);
      expect(isNSID('')).toBe(false);
      expect(isNSID(null)).toBe(false);
      expect(isNSID(123)).toBe(false);
    });
  });
});

