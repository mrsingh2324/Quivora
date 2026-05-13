import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
    });
  }

  return socket;
}
