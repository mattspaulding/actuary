import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.ts';
import type { ServiceListing } from '../types.ts';

export interface Grade {
  quality: number | null;
  rationale?: string;
}

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI | null {
  if (!config.geminiApiKey) return null;
  client ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

/**
 * Grade a paid response with Gemini: did the service deliver what its own
 * listing promises? This is the competition's required production LLM call,
 * and it runs on every paid probe — AI executing a key decision, per rubric.
 */
export async function gradeResponse(
  service: ServiceListing,
  responseBody: unknown,
): Promise<Grade> {
  const ai = gemini();
  if (!ai) return { quality: null, rationale: 'grading skipped: no GEMINI_API_KEY' };

  const body = JSON.stringify(responseBody);
  const prompt = [
    'You grade machine-commerce API responses for a trust index.',
    `Service: ${service.provider.name ?? 'unknown'} — ${service.provider.description ?? 'no description'}`,
    `Endpoint: ${service.method} ${service.resource}`,
    'Grade ONLY whether this paid response delivers what the service advertises:',
    'substance (real data vs. filler), coherence with the description, and usability by a calling agent.',
    `Response body (truncated to 4KB): ${body.slice(0, 4096)}`,
  ].join('\n');

  try {
    const result = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        // A hung grading call must never stall the round: launchd runs one
        // instance per label, so a stuck process stops the fleet entirely.
        abortSignal: AbortSignal.timeout(30_000),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quality: {
              type: Type.NUMBER,
              description: 'Overall delivery quality, 0 (junk) to 10 (excellent)',
            },
            rationale: { type: Type.STRING },
          },
          required: ['quality'],
        },
      },
    });
    const parsed = JSON.parse(result.text ?? '{}') as Grade;
    if (typeof parsed.quality !== 'number') return { quality: null };
    return {
      quality: Math.max(0, Math.min(10, parsed.quality)),
      rationale: parsed.rationale,
    };
  } catch (err) {
    return {
      quality: null,
      rationale: `grading failed: ${(err as Error).message}`,
    };
  }
}
