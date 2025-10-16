import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";

// Диагностика на случай раннего падения
console.log("🚀 Booting BuyWay backend...");
process.on("uncaughtException", (e) => console.error("Uncaught:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));

const app = express();

// CORS — разрешаем твой домен и локалку
const allowed = ["https://buyway.su", "http://localhost:5173", "http://localhost:3000"];
app.use(cors({
  origin: (origin, cb) => (!origin || allowed.includes(origin)) ? cb(null, true) : cb(new Error("Not allowed by CORS"))
}));
app.use(express.json());

// Healthchecks
app.get("/", (_, res) => res.send("OK"));
app.get("/healthz", (_, res) => res.status(200).send("ok")); // ← для Render Settings

// Почтовый транспорт
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

// API
app.post("/api/submit", async (req, res) => {
  const { name, contact, link, comment } = req.body || {};
  if (!name || !contact) return res.status(400).json({ ok:false, error:"Имя и контакт обязательны" });

  const html = `
    <h2>Новая заявка с сайта BuyWay</h2>
    <p><b>Имя:</b> ${name}</p>
    <p><b>Контакт:</b> ${contact}</p>
    <p><b>Ссылка:</b> ${link || "—"}</p>
    <p><b>Комментарий:</b> ${comment || "—"}</p>
    <p><i>${new Date().toLocaleString()}</i></p>
  `;

  try {
    await transporter.sendMail({
      from: `"BuyWay Service" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: "Новая заявка с сайта BuyWay",
      html
    });
    res.json({ ok:true });
  } catch (e) {
    console.error("MAIL ERROR:", e);
    res.status(500).json({ ok:false, error:"Mail send failed" });
  }
});

// Старт
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ API listening on :${PORT}`));
