import { createServer } from "node:http";
import pino from "pino";
import { WebSocketServer } from "ws";

const logger = pino({ name: "sandbox-firecracker" });
const port = Number(process.env.PORT ?? 8080);

const server = createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "sandbox-firecracker" }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

const sockets = new WebSocketServer({ server, path: "/v1/terminal" });
sockets.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "ready", implementation: "skeleton" }));
  socket.on("message", () => {
    socket.send(JSON.stringify({ type: "error", code: "vm_pool_not_implemented" }));
  });
});

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "sandbox service listening");
});
