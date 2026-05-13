const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const { patchConsole } = require("./utils/logger");

dotenv.config();
patchConsole();

const app = require("./app");
const connectToDatabase = require("./config/db");
const { seedDefaultQuizLibrary } = require("./config/defaultQuizLibrary");
const { seedDevUser } = require("./config/devSeed");
const { validateEnv } = require("./config/validateEnv");
const { attachQuizSocket } = require("./modules/live-sessions/socketService");
const {
  setRedisClient,
  recoverSessionsFromRedis,
} = require("./modules/live-sessions/socketSessionStore");

const PORT = process.env.PORT || 4000;

async function startServer() {
  validateEnv();
  await connectToDatabase();
  await seedDevUser();
  await seedDefaultQuizLibrary();

  const allowedOrigins = (process.env.CLIENT_URL || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const server = http.createServer(app);
  server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || 70_000);
  server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS || 75_000);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
      credentials: true,
    },
  });

  if (process.env.REDIS_URL) {
    try {
      const Redis = require("ioredis");
      const { createAdapter } = require("@socket.io/redis-adapter");

      const pubClient = new Redis(process.env.REDIS_URL, { lazyConnect: true });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      setRedisClient(pubClient);
      io.adapter(createAdapter(pubClient, subClient));

      const recovered = await recoverSessionsFromRedis();
      console.log(
        `[Redis] Connected. Adapter active. Sessions recovered: ${recovered}`
      );
    } catch (err) {
      console.warn("[Redis] Failed to connect — running without Redis:", err.message);
    }
  }

  attachQuizSocket(io);

  server.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
