import express from "express";
import cors from "cors";
import morgan from "morgan";
import dns from "node:dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import todoRouter from "./routers/todoRouter.js";

dotenv.config();

// Windows 등에서 nslookup은 되는데 Node SRV(querySrv)만 ECONNREFUSED 나는 경우 대비
if (process.env.MONGODB_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

const app = express();

const LIVE_SERVER_ORIGINS = [
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

const envClientOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const isProd = process.env.NODE_ENV === "production";

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (envClientOrigins.length > 0) {
    return envClientOrigins.includes(origin);
  }
  if (LIVE_SERVER_ORIGINS.includes(origin)) return true;
  if (!isProd) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedCorsOrigin(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
  maxAge: 86400
};

app.use((req, res, next) => {
  if (
    req.method === "OPTIONS" &&
    req.headers["access-control-request-private-network"] === "true"
  ) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI가 설정되어 있지 않습니다. (.env 확인)");
  process.exit(1);
}

app.use("/todos", todoRouter);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    })
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("연결 성공");
    })
    .catch((err) => {
      console.error("MongoDB 연결 실패", err);
    });
});

