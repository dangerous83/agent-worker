import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const scopes = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'];
const address = z.string().email().max(254).refine(value => !/[\r\n]/.test(value));
export const sendEmailSchema = z.object({ campaignId: z.string().uuid(), to: address, requestId: z.string().uuid() });
export const googleConfigSchema = z.object({ clientId: z.string().trim().endsWith('.apps.googleusercontent.com').max(300), clientSecret: z.string().trim().min(10).max(300) });

export function encodeMessage({ from, to, subject, body }) {
  address.parse(from); address.parse(to);
  if (/[\r\n]/.test(subject)) throw new Error('Email subjects cannot contain line breaks.');
  const encodedBody = Buffer.from(body, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
  return Buffer.from([`From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodedBody].join('\r\n')).toString('base64url');
}

export function createGmail({ store, vault, fetcher = fetch }) {
  const states = new Map();
  const config = () => vault.get('google-client') || (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } : null);
  async function jsonRequest(url, options) {
    const response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(response.status === 401 || data.error === 'invalid_grant' ? 'Gmail authorization expired. Reconnect Gmail.' : 'Gmail could not complete this request. Check Google account setup and try again.'); error.statusCode = 502; throw error; }
    return data;
  }
  const tokenRequest = parameters => jsonRequest('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(parameters).toString() });
  return {
    status() { const token = vault.get('gmail-token'); return { configured: Boolean(config()), connected: Boolean(token?.refresh_token || token?.access_token && token.expiresAt > Date.now()), email: token?.email || null }; },
    configure(value) { vault.set('google-client', googleConfigSchema.parse(value)); vault.set('gmail-token', null); states.clear(); },
    disconnect() { vault.set('gmail-token', null); states.clear(); },
    start(origin) {
      const settings = config(); if (!settings) throw Object.assign(new Error('Save your Google OAuth client details first.'), { statusCode: 409 });
      for (const [key, value] of states) if (value.expires < Date.now()) states.delete(key);
      if (states.size > 50) states.clear();
      const state = randomBytes(32).toString('hex');
      const redirectUri = `${origin}/auth/gmail/callback`;
      states.set(state, { expires: Date.now() + 600000, redirectUri });
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: settings.clientId, redirect_uri: redirectUri, response_type: 'code', scope: scopes.join(' '), access_type: 'offline', prompt: 'consent', state }).toString();
      return { state, url: url.toString() };
    },
    async complete({ state, cookieState, code }) {
      const pending = states.get(state);
      if (!state || state !== cookieState || !pending || pending.expires < Date.now()) throw Object.assign(new Error('Gmail sign-in expired or could not be verified. Start again.'), { statusCode: 400 });
      states.delete(state);
      const settings = config();
      const token = await tokenRequest({ code, client_id: settings.clientId, client_secret: settings.clientSecret, redirect_uri: pending.redirectUri, grant_type: 'authorization_code' });
      if (!token.access_token || !token.scope?.split(' ').includes('https://www.googleapis.com/auth/gmail.send')) throw Object.assign(new Error('Gmail sending permission was not granted. Reconnect and allow sending.'), { statusCode: 409 });
      const profile = await jsonRequest('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (!profile.email_verified) throw new Error('Google email is not verified.');
      vault.set('gmail-token', { ...token, expiresAt: Date.now() + (token.expires_in || 3600) * 1000, email: address.parse(profile.email) });
    },
    async send(input) {
      const { campaignId, to, requestId } = sendEmailSchema.parse(input);
      const campaign = store.campaigns().find(c => c.id === campaignId);
      if (!campaign || campaign.status !== 'approved') throw Object.assign(new Error('Save and approve this campaign before sending.'), { statusCode: 409 });
      const existing = store.getSetting(`delivery:${requestId}`);
      if (existing) {
        if (existing.campaignId !== campaignId || existing.to !== to) throw Object.assign(new Error('This send request was already used.'), { statusCode: 409 });
        if (existing.status === 'sent') return existing;
        throw Object.assign(new Error('This send request is already in progress or its outcome is uncertain. Check Gmail Sent before trying a new send.'), { statusCode: 409 });
      }
      let token = vault.get('gmail-token');
      if (!token) throw Object.assign(new Error('Connect Gmail before sending.'), { statusCode: 409 });
      if (token.expiresAt < Date.now() + 60000) {
        if (!token.refresh_token) throw Object.assign(new Error('Reconnect Gmail to renew sending permission.'), { statusCode: 409 });
        const settings = config();
        const refreshed = await tokenRequest({ client_id: settings.clientId, client_secret: settings.clientSecret, refresh_token: token.refresh_token, grant_type: 'refresh_token' });
        token = { ...token, ...refreshed, expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000 }; vault.set('gmail-token', token);
      }
      const raw = encodeMessage({ from: token.email, to, subject: campaign.emailSubject, body: campaign.emailBody });
      // Refreshing a token yields; another request may have claimed this send meanwhile.
      const duplicate = store.getSetting(`delivery:${requestId}`);
      if (duplicate) {
        if (duplicate.campaignId === campaignId && duplicate.to === to && duplicate.status === 'sent') return duplicate;
        throw Object.assign(new Error('This send request is already in progress. Check Gmail Sent before retrying.'), { statusCode: 409 });
      }
      const delivery = { campaignId, to, status: 'sending', createdAt: new Date().toISOString() };
      store.setSetting(`delivery:${requestId}`, delivery);
      store.updateCampaign(campaignId, { lastEmail: delivery });
      try {
        const response = await jsonRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) });
        if (!response.id) throw new Error('Gmail did not confirm sending.');
        const sent = { ...delivery, status: 'sent', messageId: response.id, sentAt: new Date().toISOString() };
        store.setSetting(`delivery:${requestId}`, sent);
        store.updateCampaign(campaignId, { lastEmail: sent });
        return sent;
      } catch {
        store.setSetting(`delivery:${requestId}`, { ...delivery, status: 'uncertain' });
        store.updateCampaign(campaignId, { lastEmail: { ...delivery, status: 'uncertain' } });
        throw Object.assign(new Error('Gmail did not confirm the result. Check your Gmail Sent folder before sending again.'), { statusCode: 502 });
      }
    },
  };
}
