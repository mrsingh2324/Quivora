import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const TOKEN_KEY = "qz_admin_token";

let socket;

export function getAdminSocket() {
  const token = localStorage.getItem(TOKEN_KEY);

  // Re-create if token changed (e.g. after login/logout)
  if (socket && socket._authToken !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      auth: { token: token || "" },
    });
    socket._authToken = token;
  }

  return socket;
}

export function disconnectAdminSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
