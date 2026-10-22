import { Client } from 'eve/client';
import { z } from 'zod';

export const campaignSchema = z.object({
  title: z.string().min(1).max(160), summary: z.string().max(4000), caption: z.string().min(1).max(2200),
  imageHeadline: z.string().min(1).max(120), imageSubline: z.string().max(240), imagePrompt: z.string().max(4000),
  emailSubject: z.string().min(1).max(200), emailBody: z.string().min(1).max(12000),
});

export function createAgent() {
  const host = process.env.EVE_HOST || 'http://127.0.0.1:2000';
  const client = new Client({ host, redirect: 'error' });
  return {
    async health() {
      try { await client.health({ signal: AbortSignal.timeout(2000) }); return true; } catch { return false; }
    },
    async generate(brief, brand) {
      const { session, response } = await client.sessions.create({
        message: `Create an Instagram and email campaign. Brief: ${brief}`,
        clientContext: { brand }, outputSchema: campaignSchema,
        signal: AbortSignal.timeout(180000),
      });
      const result = await response.result();
      if (result.status === 'failed' || !result.data) throw new Error('The AI staff could not finish. Check the model connection and retry.');
      return { ...campaignSchema.parse(result.data), sessionId: session.sessionId };
    },
  };
}
