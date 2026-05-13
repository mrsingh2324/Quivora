function write(level, args) {
  const [message, meta] = args;
  const payload = {
    level,
    time: new Date().toISOString(),
    service: "ai-orchestrator",
    message: typeof message === "string" ? message : undefined,
    meta: typeof message === "string" ? meta : message,
  };

  process[level === "error" ? "stderr" : "stdout"].write(`${JSON.stringify(payload)}\n`);
}

function patchConsole() {
  console.log = (...args) => write("info", args);
  console.info = (...args) => write("info", args);
  console.warn = (...args) => write("warn", args);
  console.error = (...args) => write("error", args);
}

module.exports = { patchConsole };
