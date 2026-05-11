import express from "express";
import cors from "cors";
import morgan from "morgan";
import dns from "node:dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import todoRouter from "./routers/todoRouter.js";

dotenv.config();

// 로컬 Windows 등에서 Node SRV(querySrv)만 실패할 때만 공용 DNS 사용 (Heroku는 DYNO 설정됨)
if (
  process.env.MONGODB_URI?.startsWith("mongodb+srv://") &&
  !process.env.DYNO
) {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

const app = express();

/** Mongo 연결 시도 후 실패하면 mongoose 에러 메시지(비밀번호 등은 넣지 않음) */
let mongoConnectError = null;

const LIVE_SERVER_ORIGINS = [
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

const envClientOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (envClientOrigins.length > 0) {
    return envClientOrigins.includes(origin);
  }
  if (LIVE_SERVER_ORIGINS.includes(origin)) return true;
  // 로컬 Vite(5173 등)에서 Heroku API 호출 — production에서도 localhost/127만 허용
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
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
  // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
  const readyState = mongoose.connection.readyState;
  res.json({
    ok: true,
    mongoConnected: readyState === 1,
    mongoReadyState: readyState,
    ...(mongoConnectError ? { mongoReason: mongoConnectError } : {})
  });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI가 설정되어 있지 않습니다. (.env 확인)");
  process.exit(1);
}

app.use(
  "/todos",
  (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        error: "Database unavailable",
        ...(mongoConnectError ? { mongoReason: mongoConnectError } : {})
      });
      return;
    }
    next();
  },
  todoRouter
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

async function start() {
  mongoConnectError = null;
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000
    });
    // eslint-disable-next-line no-console
    console.log("MongoDB 연결 성공");
  } catch (err) {
    mongoConnectError = err.message || String(err);
    console.error(
      "MongoDB 연결 실패 — Heroku Config의 MONGODB_URI, Atlas Network Access(0.0.0.0/0) 확인",
      err
    );
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${PORT}`);
    if (mongoConnectError) {
      // eslint-disable-next-line no-console
      console.error("서버는 떴지만 DB 미연결. /health 의 mongoReason 확인.");
    }
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

