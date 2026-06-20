import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { connectDatabase } from "./config/database";
import { initSocket } from "./socket";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Whatsodo API running on port ${PORT}`);
  });
};

startServer();
