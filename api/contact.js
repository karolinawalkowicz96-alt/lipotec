/**
 * POST /api/contact — LIPOTEC B2B enquiry form (Vercel Node.js function).
 *
 * Sends the enquiry to company.email through Resend (https://resend.com)
 * when these environment variables are set in Vercel:
 *   RESEND_API_KEY   — API key (server-side only, never exposed to the browser)
 *   CONTACT_FROM     — verified sender, e.g. "LIPOTEC <formularz@twojadomena.pl>"
 *   CONTACT_TO       — optional override of the recipient (defaults to company.email)
 *
 * Without configuration it answers 503 { code: "not_configured" } and the
 * page offers a pre-filled e-mail instead. It never pretends to have sent.
 */
import company from "../company.config.mjs";

const TOPICS = [
  "Zapytanie o EVA SP6",
  "Prośba o prezentację",
  "Prośba o indywidualną ofertę",
  "Pytanie o współpracę",
  "Inne",
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const hits = new Map(); // best-effort per-instance rate limit

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 20_000) throw new Error("too_large");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end(JSON.stringify({ ok: false, error: "Metoda niedozwolona." }));
  }
  const origin = req.headers.origin;
  if (origin && !/^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin) && origin !== company.siteUrl && !/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return res.status(403).end(JSON.stringify({ ok: false, error: "Niedozwolone źródło żądania." }));
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) return res.status(429).end(JSON.stringify({ ok: false, error: "Zbyt wiele prób. Spróbuj ponownie za kilka minut." }));
  recent.push(now);
  hits.set(ip, recent);

  let body;
  try { body = await readBody(req); } catch { return res.status(400).end(JSON.stringify({ ok: false, error: "Nieprawidłowe dane formularza." })); }

  // spam traps: hidden field must be empty, form must not be submitted instantly
  if (clean(body.website, 200) || Number(body.elapsed) < 2500) {
    return res.status(400).end(JSON.stringify({ ok: false, error: "Nie udało się zweryfikować formularza. Spróbuj ponownie." }));
  }

  const data = {
    name: clean(body.name, 120),
    clinic: clean(body.clinic, 180),
    email: clean(body.email, 160),
    phone: clean(body.phone, 30),
    topic: clean(body.topic, 60),
    message: clean(body.message, 4000),
    consent: body.consent === "on" || body.consent === true,
  };
  const errors = [];
  if (data.name.length < 2) errors.push("imię i nazwisko");
  if (data.clinic.length < 2) errors.push("nazwa placówki");
  if (!EMAIL_RE.test(data.email)) errors.push("adres e-mail");
  if (data.phone && !PHONE_RE.test(data.phone)) errors.push("numer telefonu");
  if (!TOPICS.includes(data.topic)) errors.push("rodzaj zapytania");
  if (data.message.length < 10) errors.push("wiadomość");
  if (!data.consent) errors.push("potwierdzenie informacji o danych");
  if (errors.length) return res.status(422).end(JSON.stringify({ ok: false, error: `Uzupełnij poprawnie: ${errors.join(", ")}.` }));

  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM;
  const to = process.env.CONTACT_TO || company.email;
  if (!key || !from) {
    return res.status(503).end(JSON.stringify({ ok: false, code: "not_configured", error: "Wysyłka formularza nie jest jeszcze skonfigurowana." }));
  }

  const rows = [
    ["Imię i nazwisko", data.name],
    ["Placówka", data.clinic],
    ["E-mail", data.email],
    ["Telefon", data.phone || "—"],
    ["Rodzaj zapytania", data.topic],
  ];
  const html = `<h2 style="font-family:Arial,sans-serif">Nowe zapytanie — ${esc(data.topic)}</h2>
<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join("")}</table>
<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;border-top:1px solid #ddd;padding-top:12px">${esc(data.message)}</p>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#888">Wysłano z formularza ${esc(company.siteUrl)}</p>`;
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${data.message}`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], reply_to: data.email, subject: `[LIPOTEC] ${data.topic} — ${data.clinic}`, html, text }),
    });
    if (!r.ok) {
      console.error("contact: provider error", r.status, await r.text().catch(() => ""));
      return res.status(502).end(JSON.stringify({ ok: false, error: `Nie udało się wysłać wiadomości. Napisz bezpośrednio na ${company.email}.` }));
    }
    return res.status(200).end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("contact: network error", err);
    return res.status(502).end(JSON.stringify({ ok: false, error: `Nie udało się wysłać wiadomości. Napisz bezpośrednio na ${company.email}.` }));
  }
}
