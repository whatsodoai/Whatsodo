import { Server, Socket } from "socket.io";
import http from "http";

let io: Server;

export function initSocket(httpServer: http.Server): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    socket.on("join:business", (businessId: string) => {
      socket.join(`business:${businessId}`);
    });

    socket.on("leave:business", (businessId: string) => {
      socket.leave(`business:${businessId}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}
