import { Schema } from 'firebase/ai';
import { PII_TYPES } from '../detection/types';

/**
 * On-device `responseConstraint` (VERIFIED-DOC: plain JSON Schema accepted by the Prompt API;
 * VERIFIED-SDK: `LanguageModelPromptOptions.responseConstraint?: object`).
 */
export const ON_DEVICE_RESPONSE_CONSTRAINT = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...PII_TYPES] },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
} as const;

/** In-cloud `responseSchema` (VERIFIED-DOC F3 helpers: Schema.object/array/string/enumString). */
export function buildCloudResponseSchema() {
  return Schema.object({
    properties: {
      findings: Schema.array({
        items: Schema.object({
          properties: {
            type: Schema.enumString({ enum: [...PII_TYPES] }),
            text: Schema.string(),
          },
        }),
      }),
    },
  });
}
