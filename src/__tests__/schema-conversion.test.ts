/**
 * Tests for Zod to JSON Schema conversion
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AtpMcpServer } from '../index.js';

// Helper to access private method for testing
function getZodToJsonSchema(server: AtpMcpServer) {
  return (server as any).zodToJsonSchema.bind(server);
}

describe('Zod to JSON Schema Conversion', () => {
  let server: AtpMcpServer;
  let zodToJsonSchema: (schema: z.ZodSchema) => any;

  beforeAll(() => {
    server = new AtpMcpServer();
    zodToJsonSchema = getZodToJsonSchema(server);
  });

  describe('Basic Types', () => {
    it('should convert ZodString to JSON Schema', () => {
      const schema = z.string();
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({ type: 'string' });
    });

    it('should convert ZodNumber to JSON Schema', () => {
      const schema = z.number();
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({ type: 'number' });
    });

    it('should convert ZodBoolean to JSON Schema', () => {
      const schema = z.boolean();
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({ type: 'boolean' });
    });

    it('should convert ZodArray to JSON Schema', () => {
      const schema = z.array(z.string());
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });
  });

  describe('Object Schemas', () => {
    it('should convert simple object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
        required: ['name', 'age', 'active'],
      });
    });

    it('should handle optional properties', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name'],
      });
    });

    it('should handle nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
        settings: z
          .object({
            theme: z.string(),
          })
          .optional(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['name', 'email'],
          },
          settings: {
            type: 'object',
            properties: {
              theme: { type: 'string' },
            },
            required: ['theme'],
          },
        },
        required: ['user'],
      });
    });
  });

  describe('String Constraints', () => {
    it('should handle string min/max length', () => {
      const schema = z.string().min(5).max(100);
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'string',
        minLength: 5,
        maxLength: 100,
      });
    });

    it('should handle string regex pattern', () => {
      const schema = z.string().regex(/^[a-z]+$/);
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'string',
        pattern: '^[a-z]+$',
      });
    });
  });

  describe('Number Constraints', () => {
    it('should handle number min/max', () => {
      const schema = z.number().min(0).max(100);
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'number',
        minimum: 0,
        maximum: 100,
      });
    });

    it('should handle integer type', () => {
      const schema = z.number().int();
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'integer',
      });
    });
  });

  describe('Enum Types', () => {
    it('should convert ZodEnum to JSON Schema', () => {
      const schema = z.enum(['red', 'green', 'blue']);
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'string',
        enum: ['red', 'green', 'blue'],
      });
    });
  });

  describe('Array Types', () => {
    it('should handle array with item type', () => {
      const schema = z.array(z.string());
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should handle array of objects', () => {
      const schema = z.array(
        z.object({
          id: z.number(),
          name: z.string(),
        })
      );

      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
          required: ['id', 'name'],
        },
      });
    });
  });

  describe('Union Types', () => {
    it('should handle union types', () => {
      const schema = z.union([z.string(), z.number()]);
      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        anyOf: [{ type: 'string' }, { type: 'number' }],
      });
    });
  });

  describe('Complex Real-world Schema', () => {
    it('should convert create post schema correctly', () => {
      const schema = z.object({
        text: z.string().min(1).max(300),
        images: z.array(z.any()).optional(),
        external: z
          .object({
            uri: z.string(),
            title: z.string(),
            description: z.string().optional(),
          })
          .optional(),
        languages: z.array(z.string().length(2)).optional(),
        reply: z
          .object({
            root: z.object({
              uri: z.string(),
              cid: z.string(),
            }),
            parent: z.object({
              uri: z.string(),
              cid: z.string(),
            }),
          })
          .optional(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          text: {
            type: 'string',
            minLength: 1,
            maxLength: 300,
          },
          images: {
            type: 'array',
            items: { type: 'object' },
          },
          external: {
            type: 'object',
            properties: {
              uri: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['uri', 'title'],
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
          },
          reply: {
            type: 'object',
            properties: {
              root: {
                type: 'object',
                properties: {
                  uri: { type: 'string' },
                  cid: { type: 'string' },
                },
                required: ['uri', 'cid'],
              },
              parent: {
                type: 'object',
                properties: {
                  uri: { type: 'string' },
                  cid: { type: 'string' },
                },
                required: ['uri', 'cid'],
              },
            },
            required: ['root', 'parent'],
          },
        },
        required: ['text'],
      });
    });
  });
});
