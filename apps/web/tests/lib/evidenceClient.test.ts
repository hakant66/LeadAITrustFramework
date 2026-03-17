/**
 * Evidence Client Tests
 * 
 * Tests for the evidence client library functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initEvidence,
  putEvidenceBytes,
  finalizeEvidence,
  listEvidence,
  resolveControlId,
  getDownloadUrl,
  deleteEvidence,
  uploadEvidenceFile,
} from '@/lib/evidenceClient';

// Mock coreApiBase
vi.mock('@/lib/coreApiBase', () => ({
  coreApiBase: () => 'http://localhost:8000',
}));

describe('evidenceClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initEvidence', () => {
    it('should initialize evidence and return upload URL', async () => {
      const mockResponse = {
        evidence_id: 123,
        upload_url: 'https://s3.amazonaws.com/bucket/key',
        upload_headers: { 'Content-Type': 'application/pdf' },
        uri: 's3://bucket/key',
        status: 'pending',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await initEvidence(
        'test-project',
        'control-123',
        'test.pdf',
        'application/pdf',
        1024,
        'user@example.com'
      );

      expect(result.evidence_id).toBe(123);
      expect(result.upload_url).toBe('https://s3.amazonaws.com/bucket/key');
      expect(result.status).toBe('pending');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/projects/test-project/controls/control-123/evidence:init'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should fallback to /init endpoint if :init fails', async () => {
      const mockResponse = {
        evidence_id: 123,
        upload_url: 'https://s3.amazonaws.com/bucket/key',
      };

      // First call returns 404
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

      await initEvidence('test-project', 'control-123', 'test.pdf', 'application/pdf', 1024);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect((global.fetch as any).mock.calls[1][0]).toContain('/evidence/init');
    });

    it('should include createdBy in request body when provided', async () => {
      const mockResponse = { evidence_id: 123, upload_url: 'https://s3.amazonaws.com/bucket/key' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await initEvidence('test-project', 'control-123', 'test.pdf', 'application/pdf', 1024, 'user@example.com');

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.createdBy).toBe('user@example.com');
      expect(body.created_by).toBe('user@example.com');
    });
  });

  describe('putEvidenceBytes', () => {
    it('should upload file bytes to presigned URL', async () => {
      const file = new Blob(['test content'], { type: 'application/pdf' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await putEvidenceBytes('https://s3.amazonaws.com/bucket/key', file);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/core'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/pdf',
          }),
          body: file,
        })
      );
    });

    it('should set Content-Type header from file type', async () => {
      const file = new Blob(['test'], { type: 'image/png' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await putEvidenceBytes('https://s3.amazonaws.com/bucket/key', file);

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers['Content-Type']).toBe('image/png');
    });

    it('should throw error on upload failure', async () => {
      const file = new Blob(['test']);
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      });

      await expect(
        putEvidenceBytes('https://s3.amazonaws.com/bucket/key', file)
      ).rejects.toThrow();
    });
  });

  describe('finalizeEvidence', () => {
    it('should finalize evidence upload', async () => {
      const mockResponse = { ok: true, evidence_id: 123 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await finalizeEvidence('test-project', 'control-123', 123, 'abc123', 'user@example.com');

      expect(result.ok).toBe(true);
      expect(result.evidence_id).toBe(123);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/evidence:finalize'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should fallback to /finalize endpoint if :finalize fails', async () => {
      const mockResponse = { ok: true };
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

      await finalizeEvidence('test-project', 'control-123', 123);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect((global.fetch as any).mock.calls[1][0]).toContain('/evidence/finalize');
    });
  });

  describe('listEvidence', () => {
    it('should return normalized items array', async () => {
      const mockResponse = { items: [{ id: 1, name: 'test.pdf' }] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await listEvidence('test-project', 'control-123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('test.pdf');
    });

    it('should normalize bare array response', async () => {
      const mockResponse = [{ id: 1, name: 'test.pdf' }];
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await listEvidence('test-project', 'control-123');

      expect(result.items).toHaveLength(1);
    });

    it('should normalize attachments array', async () => {
      const mockResponse = { attachments: [{ id: 1, name: 'test.pdf' }] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await listEvidence('test-project', 'control-123');

      expect(result.items).toHaveLength(1);
    });

    it('should return empty array for unknown response shape', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const result = await listEvidence('test-project', 'control-123');

      expect(result.items).toEqual([]);
    });
  });

  describe('resolveControlId', () => {
    it('should return control_id when found', async () => {
      const mockResponse = { control_id: 'control-123' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await resolveControlId('test-project', 'test-kpi');

      expect(result).toBe('control-123');
    });

    it('should return null on 404', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await resolveControlId('test-project', 'nonexistent-kpi');

      expect(result).toBeNull();
    });
  });

  describe('getDownloadUrl', () => {
    it('should return download URL', async () => {
      const mockResponse = { url: 'https://s3.amazonaws.com/bucket/key' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await getDownloadUrl(123);

      expect(result).toContain('/api/core');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/evidence/123:download-url'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence', async () => {
      const mockResponse = { ok: true, deleted: 123 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await deleteEvidence(123);

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(123);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/evidences/123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('uploadEvidenceFile', () => {
    it('should complete full upload flow: init -> PUT -> finalize', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      // Mock initEvidence
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            evidence_id: 123,
            upload_url: 'https://s3.amazonaws.com/bucket/key',
            upload_headers: { 'Content-Type': 'application/pdf' },
            uri: 's3://bucket/key',
          }),
        })
        // Mock PUT
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        })
        // Mock finalize
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });

      const result = await uploadEvidenceFile('test-project', 'control-123', file, undefined, 'user@example.com');

      expect(result.evidenceId).toBe(123);
      expect(result.storageUrl).toBe('s3://bucket/key');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle PUT failure with fallback', async () => {
      const file = new File(['test'], 'test.pdf');
      
      // Mock initEvidence
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            evidence_id: 123,
            upload_url: 'https://s3.amazonaws.com/bucket/key',
            uri: 's3://bucket/key',
          }),
        })
        // Mock PUT failure
        .mockRejectedValueOnce(new Error('Network error'))
        // Mock fallback PUT
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        })
        // Mock finalize
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });

      // Mock window for browser fallback
      Object.defineProperty(window, 'window', {
        value: {},
        writable: true,
      });

      const result = await uploadEvidenceFile('test-project', 'control-123', file);

      expect(result.evidenceId).toBe(123);
    });

    it('should throw error if init fails', async () => {
      const file = new File(['test'], 'test.pdf');
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(
        uploadEvidenceFile('test-project', 'control-123', file)
      ).rejects.toThrow();
    });
  });
});
