import { WebSocketServer } from "ws";
import http from "http";
import os from "os";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const rootDir = path.join(__dirname, "..");
const publicUrlFile = path.join(rootDir, ".radar-public-url.txt");
const shutdownFile = path.join(rootDir, ".radar-shutdown");
const cloudflaredLog = path.join(rootDir, ".cloudflared.log");
const cloudflaredPath = path.join(rootDir, "tools", "cloudflared.exe");
const cloudflaredDownloadUrl =
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";

const webPort = Number(process.env.RADAR_WEB_PORT || 5173);
const PUBLIC_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

let tunnelProcess = null;
let cachedPublicUrl = null;
let tunnelStatus = "idle";
let tunnelError = null;
let tunnelPollTimer = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function readPublicUrl() {
  if (cachedPublicUrl) {
    return cachedPublicUrl;
  }

  try {
    const value = fs.readFileSync(publicUrlFile, "utf8").trim();
    if (value) {
      cachedPublicUrl = value;
      tunnelStatus = "ready";
      return value;
    }
  } catch {
    // no file yet
  }

  scanTunnelLogs();
  return cachedPublicUrl;
}

function persistPublicUrl(url) {
  if (!url || cachedPublicUrl === url) {
    return;
  }

  cachedPublicUrl = url;
  tunnelStatus = "ready";
  tunnelError = null;
  fs.writeFileSync(publicUrlFile, url, "utf8");
  console.info(`public share link ready: ${url}`);
}

function scanTunnelLogs(extraText = "") {
  let content = extraText;
  try {
    content = fs.readFileSync(cloudflaredLog, "utf8") + extraText;
  } catch {
    // log not created yet
  }

  const match = content.match(PUBLIC_URL_REGEX);
  if (match?.[0]) {
    persistPublicUrl(match[0]);
  }
}

async function ensureCloudflaredBinary() {
  if (fs.existsSync(cloudflaredPath)) {
    return true;
  }

  fs.mkdirSync(path.dirname(cloudflaredPath), { recursive: true });
  console.info("downloading cloudflared...");

  try {
    const response = await fetch(cloudflaredDownloadUrl);
    if (!response.ok) {
      throw new Error(`download failed (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(cloudflaredPath, buffer);
    console.info("cloudflared downloaded");
    return true;
  } catch (error) {
    tunnelStatus = "failed";
    tunnelError = error.message;
    console.warn(`cloudflared download failed: ${error.message}`);
    return false;
  }
}

function stopPublicTunnel() {
  if (tunnelPollTimer) {
    clearInterval(tunnelPollTimer);
    tunnelPollTimer = null;
  }

  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
  }
}

async function startPublicTunnel() {
  stopPublicTunnel();

  tunnelStatus = "starting";
  tunnelError = null;
  cachedPublicUrl = null;

  try {
    fs.unlinkSync(publicUrlFile);
  } catch {
    // ignore
  }

  try {
    fs.writeFileSync(cloudflaredLog, "", "utf8");
  } catch {
    // ignore
  }

  if (!(await ensureCloudflaredBinary())) {
    return;
  }

  tunnelProcess = spawn(
    cloudflaredPath,
    ["tunnel", "--url", `http://127.0.0.1:${webPort}`, "--no-autoupdate"],
    {
      cwd: rootDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const onTunnelOutput = (chunk) => {
    const text = chunk.toString("utf8");
    try {
      fs.appendFileSync(cloudflaredLog, text);
    } catch {
      // ignore
    }
    scanTunnelLogs(text);
  };

  tunnelProcess.stdout.on("data", onTunnelOutput);
  tunnelProcess.stderr.on("data", onTunnelOutput);

  tunnelProcess.on("exit", (code) => {
    tunnelProcess = null;
    if (tunnelStatus !== "ready") {
      tunnelStatus = "failed";
      tunnelError = `cloudflared exited (code ${code ?? "unknown"})`;
      console.warn(tunnelError);
    }
  });

  tunnelPollTimer = setInterval(() => {
    if (tunnelStatus === "ready") {
      stopPublicTunnelPoll();
      return;
    }
    scanTunnelLogs();
  }, 1000);
}

function stopPublicTunnelPoll() {
  if (tunnelPollTimer) {
    clearInterval(tunnelPollTimer);
    tunnelPollTimer = null;
  }
}

function getLanUrls(port) {
  const urls = new Set();
  const nets = os.networkInterfaces();

  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        urls.add(`http://${net.address}:${port}`);
      }
    }
  }

  return [...urls];
}

function isLocalRequest(req) {
  const addr = req.socket.remoteAddress?.replace("::ffff:", "") ?? "";
  return addr === "127.0.0.1" || addr === "::1";
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(distDir, safePath);

  if (urlPath === "/" || urlPath.endsWith("/")) {
    filePath = path.join(distDir, "index.html");
  } else if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath = path.join(distDir, "index.html");
  }

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (path.extname(filePath) === ".html" || !path.extname(filePath)) {
        fs.readFile(path.join(distDir, "index.html"), (indexErr, indexData) => {
          if (indexErr) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(indexData);
        });
        return;
      }
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/shutdown") {
    if (!isLocalRequest(req)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "host only" }));
      return;
    }

    try {
      stopPublicTunnel();
      fs.writeFileSync(shutdownFile, String(Date.now()), "utf8");
    } catch (error) {
      console.error("failed to write shutdown signal:", error);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/api/radar/share-info") {
    const viewerUrls = getLanUrls(webPort);
    const publicUrl = readPublicUrl();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        localUrl: `http://localhost:${webPort}`,
        publicUrl,
        tunnelStatus,
        tunnelError,
        viewerUrls,
        webPort,
        hasLiveData: Boolean(lastGamePayload),
        readerConnected: readerClient !== null,
        viewerCount: countBrowserClients(),
      })
    );
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(404);
  res.end();
});

const webSocketServers = [];

let readerClient = null;
let lastGamePayload = null;
let sharedSession = null;

function allClients() {
  const clients = new Set();
  for (const wss of webSocketServers) {
    wss.clients.forEach((client) => clients.add(client));
  }
  return clients;
}

function countBrowserClients() {
  let count = 0;
  allClients().forEach((client) => {
    if (client.readyState !== 1 || client === readerClient) {
      return;
    }

    const address = client._clientAddress ?? "";
    if (address === "127.0.0.1" || address === "::1") {
      return;
    }

    count += 1;
  });
  return count;
}

function sendToBrowsers(message, excludeClient = null) {
  allClients().forEach((client) => {
    if (
      client.readyState === 1 &&
      client !== readerClient &&
      client !== excludeClient
    ) {
      client.send(message);
    }
  });
}

function sendSessionState(client) {
  if (lastGamePayload && client.readyState === 1) {
    client.send(lastGamePayload);
  }

  if (sharedSession && client.readyState === 1) {
    client.send(
      JSON.stringify({
        m_message_type: "session_share",
        m_calibration: sharedSession.m_calibration,
        m_settings: sharedSession.m_settings,
      })
    );
  }
}

function bindWebSocketServer(webSocketServer) {
  webSocketServers.push(webSocketServer);

  webSocketServer.on("connection", (webSocket, request) => {
    const clientAddress = request.socket.remoteAddress.replace("::ffff:", "");
    webSocket._clientAddress = clientAddress;
    console.info(`${clientAddress} connected`);

    if (webSocket !== readerClient) {
      sendSessionState(webSocket);
    }

    webSocket.on("message", (message) => {
      const text = message.toString();

      try {
        const parsed = JSON.parse(text);
        if (parsed.m_message_type === "session_share") {
          sharedSession = {
            m_calibration: parsed.m_calibration ?? null,
            m_settings: parsed.m_settings ?? null,
          };
          console.info(`${clientAddress} updated shared session`);
          sendToBrowsers(text, webSocket);
          return;
        }
      } catch {
        // not JSON control message
      }

      if (text.includes('"m_source"')) {
        if (readerClient !== webSocket) {
          readerClient = webSocket;
          console.info(`${clientAddress} registered as memory reader`);
        }
        lastGamePayload = text;
      }

      allClients().forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    });

    webSocket.on("close", () => {
      if (readerClient === webSocket) {
        readerClient = null;
        console.info("memory reader disconnected");
      }
      console.info(`${clientAddress} disconnected`);
    });

    webSocket.on("error", (error) => {
      console.error(error);
    });
  });
}

bindWebSocketServer(new WebSocketServer({
  server,
  path: "/deadlock_webradar",
}));

const legacyPort = Number(process.env.RADAR_LEGACY_WS_PORT || 22006);
const legacyServer = http.createServer((_req, res) => {
  res.writeHead(404);
  res.end();
});
bindWebSocketServer(new WebSocketServer({
  server: legacyServer,
  path: "/deadlock_webradar",
}));

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`port ${webPort} already in use`);
    process.exit(1);
  }
  console.error(error);
});

if (!fs.existsSync(distDir)) {
  console.error(`missing build output: ${distDir} (run npm run build)`);
  process.exit(1);
}

server.listen(webPort, "0.0.0.0", () => {
  console.info(`WebRadarDL host listening on 0.0.0.0:${webPort}`);
  startPublicTunnel().catch((error) => {
    tunnelStatus = "failed";
    tunnelError = error.message;
    console.warn(`public tunnel failed to start: ${error.message}`);
  });
});

legacyServer.listen(legacyPort, "127.0.0.1", () => {
  console.info(`legacy memory reader relay on 127.0.0.1:${legacyPort}`);
});
