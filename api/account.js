// Vercel serverless function: account jobs that need the server.
//   GET  /api/account?action=devices                          -> the account's signed-in devices
//   POST /api/account  { action: 'ping' }                     -> record / refresh this device (browser, rough location)
//   POST /api/account  { action: 'signout', target, code }    -> sign out one device (session id) or 'others', after the
//                                                                 emailed code is checked here
//   POST /api/account  { action: 'discord', providerToken }   -> after "Continue with Discord": add the person to the
//                                                                 Discord server and return their Discord avatar / decoration
// The person's own sign-in token (Authorization: Bearer …) proves who they are.
// Needs (server only): SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), and for Discord: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID.
const base = () => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const secret = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anon = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || secret();
const admin = () => ({ apikey: secret(), ...(secret().startsWith('eyJ') ? { Authorization: `Bearer ${secret()}` } : {}), 'Content-Type': 'application/json' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hits = new Map(); // ip -> [timestamps] for the email-code step

/** The claims inside a sign-in token (only trusted after the token was checked with Supabase) */
function claims(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

/** Browser, system and kind of device from the user-agent string */
function describe(ua) {
  const u = String(ua || '');
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung Internet' : /Firefox\//.test(u) ? 'Firefox' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Browser';
  const os = /Android/.test(u) ? 'Android' : /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac OS X|Macintosh/.test(u) ? 'macOS' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : '';
  const kind = /iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u)) ? 'tablet' : /Mobi|iPhone|Android/.test(u) ? 'phone' : 'computer';
  return { browser, os, kind };
}

const header = (req, k) => {
  const v = req.headers[k];
  try {
    return v ? decodeURIComponent(String(v)) : null;
  } catch {
    return String(v);
  }
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const B = base();
  if (!B.startsWith('https://') || !secret()) return res.status(500).json({ error: "Accounts aren't fully set up yet." });

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in again, then try once more.' });

  // who is asking (checked with their own token)
  let user;
  try {
    const who = await fetch(`${B}/auth/v1/user`, { headers: { apikey: anon(), Authorization: `Bearer ${token}` } });
    if (!who.ok) return res.status(401).json({ error: 'Your sign-in has expired. Sign in again.' });
    user = await who.json();
  } catch {
    return res.status(502).json({ error: "Couldn't reach the account server. Try again." });
  }
  if (!user?.id) return res.status(401).json({ error: 'Sign in again, then try once more.' });
  const session = claims(token).session_id;

  let b = req.body;
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b);
    } catch {
      b = {};
    }
  }
  b = b && typeof b === 'object' ? b : {};
  const action = req.method === 'GET' ? String(req.query.action || '') : String(b.action || '');

  try {
    // ---- the account's devices
    if (req.method === 'GET' && action === 'devices') {
      const r = await fetch(`${B}/rest/v1/rpc/list_devices`, { method: 'POST', headers: admin(), body: JSON.stringify({ p_user: user.id }) });
      const rows = r.ok ? await r.json() : [];
      return res.status(200).json({
        devices: (Array.isArray(rows) ? rows : []).map((d) => ({
          id: d.session_id,
          browser: d.browser,
          os: d.os,
          kind: d.kind,
          place: [d.city, d.region, d.country].filter(Boolean).join(', '),
          firstSeen: d.first_seen,
          lastSeen: d.last_seen,
          current: d.session_id === session
        }))
      });
    }

    // ---- record this device
    if (req.method === 'POST' && action === 'ping') {
      if (!UUID.test(String(session || ''))) return res.status(204).end();
      const d = describe(req.headers['user-agent']);
      await fetch(`${B}/rest/v1/devices?on_conflict=session_id`, {
        method: 'POST',
        headers: { ...admin(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          session_id: session,
          user_id: user.id,
          ...d,
          city: header(req, 'x-vercel-ip-city'),
          region: header(req, 'x-vercel-ip-country-region'),
          country: header(req, 'x-vercel-ip-country'),
          last_seen: new Date().toISOString()
        })
      });
      return res.status(204).end();
    }

    // ---- sign devices out, after the emailed code
    if (req.method === 'POST' && action === 'signout') {
      const target = String(b.target || '');
      const code = String(b.code || '').replace(/\D/g, '');
      if (target !== 'others' && !UUID.test(target)) return res.status(400).json({ error: 'Bad request.' });
      if (target === session) return res.status(400).json({ error: 'To sign out this device, use Sign out.' });
      if (code.length < 6) return res.status(400).json({ error: 'Enter the code from your email.' });
      const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
      const now = Date.now();
      const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
      if (recent.length >= 8) return res.status(429).json({ error: 'Too many tries. Wait a few minutes.' });
      hits.set(ip, [...recent, now]);

      // the code must be one emailed to this account
      const v = await fetch(`${B}/auth/v1/verify`, {
        method: 'POST',
        headers: { apikey: anon(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', email: user.email, token: code })
      });
      const vj = await v.json().catch(() => ({}));
      if (!v.ok || !vj.access_token) return res.status(400).json({ error: 'That code is wrong or has expired.' });
      const extra = claims(vj.access_token).session_id; // checking the code opened a sign-in of its own: close it too

      const revoke = (only) =>
        fetch(`${B}/rest/v1/rpc/revoke_sessions`, { method: 'POST', headers: admin(), body: JSON.stringify({ p_user: user.id, p_keep: session, p_only: only }) });
      if (target === 'others') await revoke(null);
      else {
        await revoke(target);
        if (UUID.test(String(extra || ''))) await revoke(extra);
      }
      return res.status(200).json({ ok: true });
    }

    // ---- "Continue with Discord": join the server, share the Discord avatar / decoration
    if (req.method === 'POST' && action === 'discord') {
      const providerToken = String(b.providerToken || '');
      if (!providerToken) return res.status(400).json({ error: 'Bad request.' });
      const me = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${providerToken}` } });
      if (!me.ok) return res.status(400).json({ error: "Couldn't read your Discord account." });
      const du = await me.json();
      // the Discord account must be the one linked to this sign-in
      const linked = (user.identities || []).some((i) => i.provider === 'discord' && String(i.identity_data?.provider_id || i.identity_data?.sub || i.id) === String(du.id));
      if (!linked) return res.status(403).json({ error: 'That Discord account is not linked to this sign-in.' });

      let joined = 'skipped';
      const bot = process.env.DISCORD_BOT_TOKEN;
      const guild = process.env.DISCORD_GUILD_ID;
      if (bot && guild) {
        const j = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guild)}/members/${encodeURIComponent(du.id)}`, {
          method: 'PUT',
          headers: { Authorization: `Bot ${bot}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: providerToken })
        });
        joined = j.status === 201 ? 'joined' : j.status === 204 ? 'already' : 'failed';
        if (joined === 'failed') console.error('[account] discord join failed', j.status, await j.text().catch(() => ''));
      }
      const ext = du.avatar && String(du.avatar).startsWith('a_') ? 'gif' : 'png';
      // Discord nameplate (a path like "nameplates/nameplates/twilight/"); Discord doesn't share profile effects with sites
      const plate = du.collectibles?.nameplate;
      const plateAsset = plate && /^nameplates\/[A-Za-z0-9_\/-]+\/$/.test(String(plate.asset || '')) ? String(plate.asset) : null;
      return res.status(200).json({
        joined,
        name: du.global_name || du.username,
        avatar: du.avatar ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.${ext}?size=256` : null,
        decoration: du.avatar_decoration_data?.asset ? `https://cdn.discordapp.com/avatar-decoration-presets/${du.avatar_decoration_data.asset}.png?size=240&passthrough=true` : null,
        nameplate: plateAsset ? { asset: plateAsset, palette: String(plate.palette || '') } : null
      });
    }
  } catch (e) {
    console.error('[account]', action, e);
    return res.status(502).json({ error: "Couldn't reach the account server. Try again." });
  }

  return res.status(400).json({ error: 'Bad request.' });
}
