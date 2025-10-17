import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dns from "dns"; // ← только один импорт

// Диагностика на случай раннего падения
console.log("🚀 Booting BuyWay backend...");
process.on("uncaughtException", (e) => console.error("Uncaught:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));

const app = express();

// --- CORS: разрешаем твой домен и локалку ---
const allowed = [
  "https://buyway.su",
  "https://www.buyway.su",
  "http://localhost:5173",
  "http://localhost:3000",
];
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS")),
  })
);
app.use(express.json());

// --- Healthchecks ---
app.get("/", (_, res) => res.send("OK"));
app.get("/healthz", (_, res) => res.status(200).send("ok")); // для Render Settings

// --- Почтовый транспорт (с IPv4 и fallback) ---
dns.setDefaultResultOrder?.("ipv4first"); // форсим IPv4 (важно на Render)

function makeGmailTransport({ port, secure }) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port, // 465 или 587
    secure, // 465 → true, 587 → false
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
    tls: { servername: "smtp.gmail.com" },
  });
}

// основной SMTP
let transporter = makeGmailTransport({ port: 465, secure: true });

// fallback на порт 587
async function sendMailWithFallback(options) {
  try {
    await transporter.sendMail(options);
  } catch (e) {
    console.error("MAIL ERROR primary (465):", e?.code || e?.message);
    const fallback = makeGmailTransport({ port: 587, secure: false });
    await fallback.verify().catch((err) =>
      console.error("VERIFY 587:", err?.code || err?.message)
    );
    await fallback.sendMail(options);
  }
}

// --- API ---
app.post("/api/submit", async (req, res) => {
  const { name, contact, link, comment } = req.body || {};
  if (!name || !contact)
    return res
      .status(400)
      .json({ ok: false, error: "Имя и контакт обязательны" });

  const html = `
    <h2>Новая заявка с сайта BuyWay</h2>
    <p><b>Имя:</b> ${name}</p>
    <p><b>Контакт:</b> ${contact}</p>
    <p><b>Ссылка:</b> ${link || "—"}</p>
    <p><b>Комментарий:</b> ${comment || "—"}</p>
    <p><i>${new Date().toLocaleString()}</i></p>
  `;

  try {
    await sendMailWithFallback({
      from: `"BuyWay Service" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: "Новая заявка с сайта BuyWay",
      html,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("MAIL ERROR:", e);
    res.status(500).json({ ok: false, error: "Mail send failed" });
  }
});

// --- Старт сервера ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ API listening on :${PORT}`)
);
