const { verifyToken } = require("../../middleware/auth");
const { recordCheatingSignal } = require("../answers/attemptService");
const Quiz = require("../quiz-publishing/Quiz");
const { dispatchQuizIntegrationEvent } = require("../../services/integrationService");
const quizEventBus = require("./quizEventBus");
const {
  advanceQuizSession,
  getQuizSessionLeaderboard,
  joinQuizSession,
  leaveQuizSession,
  startQuizSession,
  submitQuizAnswer,
} = require("./quizEngine");

function attachQuizSocket(io) {
  // Extract JWT from socket handshake auth and attach user info.
  // Non-authenticated connections are still allowed (participants don't log in).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (token) {
      try {
        const payload = verifyToken(token);
        socket.data.userId = payload.userId;
        socket.data.userRole = payload.role;
      } catch {
        // token present but invalid — treat as anonymous
      }
    }

    next();
  });

  quizEventBus.on("room:event", ({ roomCode, eventName, payload }) => {
    io.to(roomCode).emit(eventName, payload);
  });

  quizEventBus.on("room:targeted-event", ({ roomCode, eventName, hostPayload, participantPayloads = {} }) => {
    for (const [, joinedSocket] of io.sockets.sockets) {
      if (!joinedSocket.rooms.has(roomCode)) continue;

      if (joinedSocket.data.role === "participant" && joinedSocket.data.attemptId) {
        const participantPayload = participantPayloads[String(joinedSocket.data.attemptId)];
        joinedSocket.emit(eventName, participantPayload || hostPayload);
        continue;
      }

      joinedSocket.emit(eventName, hostPayload);
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:join", async (payload, callback = () => {}) => {
      try {
        const { joinCode, role = "participant", attemptId, name } = payload || {};

        if (!joinCode) throw new Error("joinCode is required");

        const roomCode = joinCode.toUpperCase();
        socket.join(roomCode);

        const snapshot = await joinQuizSession({
          joinCode: roomCode,
          role,
          attemptId,
          socketId: socket.id,
          userId: socket.data.userId || null,
        });

        socket.data.joinCode = roomCode;
        socket.data.role = role;
        socket.data.attemptId = attemptId || null;
        socket.data.name = name || "Guest";

        const participants = [];

        for (const [, joinedSocket] of io.sockets.sockets) {
          if (
            joinedSocket.data.joinCode === roomCode &&
            joinedSocket.data.role === "participant"
          ) {
            participants.push(joinedSocket.data.name || "Guest");
          }
        }

        snapshot.participants = participants;

        if (role === "participant") {
          io.to(roomCode).emit("room:participant-joined", {
            joinCode: roomCode,
            name: socket.data.name,
            participants,
          });
          if (snapshot.quizId) {
            Quiz.findById(snapshot.quizId)
              .then((quiz) =>
                quiz
                  ? dispatchQuizIntegrationEvent(quiz, "participant.joined", {
                      joinCode: roomCode,
                      attemptId: attemptId || null,
                      name: socket.data.name,
                    })
                  : null
              )
              .catch((error) => console.warn("[Integrations] participant.joined failed", error.message));
          }
        }

        callback({ ok: true, data: snapshot });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });

    socket.on("host:start-quiz", async (payload, callback = () => {}) => {
      try {
        const joinCode = (payload?.joinCode || socket.data.joinCode || "").toUpperCase();

        if (!joinCode) throw new Error("joinCode is required");

        if (!socket.data.userId) {
          throw new Error("Authentication required to start a quiz");
        }

        await startQuizSession(joinCode, socket.data.userId);
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });

    socket.on("host:next-question", async (payload, callback = () => {}) => {
      try {
        const joinCode = (payload?.joinCode || socket.data.joinCode || "").toUpperCase();

        if (!joinCode) throw new Error("joinCode is required");

        if (!socket.data.userId) {
          throw new Error("Authentication required to advance the quiz");
        }

        await advanceQuizSession(joinCode, socket.data.userId);
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });

    socket.on("player:submit-answer", async (payload, callback = () => {}) => {
      try {
        const { joinCode, attemptId, questionId, selectedOptionIndex } = payload || {};

        if (!joinCode || !attemptId || !questionId || selectedOptionIndex === undefined) {
          throw new Error("attemptId, joinCode, questionId, and selectedOptionIndex are required");
        }

        const result = await submitQuizAnswer({
          joinCode,
          attemptId,
          questionId,
          selectedOptionIndex,
        });

        callback({ ok: true, data: result });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });

    socket.on("participant:tab-away", async (payload, callback = () => {}) => {
      try {
        const attemptId = payload?.attemptId || socket.data.attemptId;
        if (!attemptId) throw new Error("attemptId is required");

        await recordCheatingSignal({
          attemptId,
          type: "tab_away",
          meta: {
            joinCode: (payload?.joinCode || socket.data.joinCode || "").toUpperCase(),
            reason: payload?.reason || "visibilitychange",
            clientTimestamp: payload?.timestamp || null,
          },
        });

        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });

    socket.on("leaderboard:get", async (payload, callback = () => {}) => {
      try {
        const joinCode = (payload?.joinCode || socket.data.joinCode || "").toUpperCase();

        if (!joinCode) throw new Error("joinCode is required");

        const leaderboard = await getQuizSessionLeaderboard(joinCode);
        callback({ ok: true, data: leaderboard });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });

    socket.on("disconnect", () => {
      leaveQuizSession({
        joinCode: socket.data?.joinCode,
        role: socket.data?.role,
        attemptId: socket.data?.attemptId,
      });
    });
  });
}

module.exports = { attachQuizSocket };
