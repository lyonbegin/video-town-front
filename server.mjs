import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import {
  appendFile,
  readFile,
} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname =
  path.dirname(fileURLToPath(import.meta.url));

const DIST_DIR =
  path.join(__dirname, 'dist');

const LOG_DIR =
  process.env.MASK_DEBUG_DIR ||
  '/tmp/video-town-mask-debug';

const PORT =
  Number(process.env.PORT) || 4173;

const MAX_BODY_BYTES =
  8 * 1024 * 1024;

const MAX_SESSION_FILE_BYTES =
  128 * 1024 * 1024;

mkdirSync(LOG_DIR, {
  recursive: true,
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(
  res,
  status,
  value,
) {
  const body = JSON.stringify(value);

  res.writeHead(status, {
    'content-type':
      'application/json; charset=utf-8',
    'content-length':
      Buffer.byteLength(body),
    'cache-control': 'no-store',
  });

  res.end(body);
}

function isValidSessionId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]{16,80}$/.test(
      value,
    )
  );
}

function getLogPath(sessionId) {
  return path.join(
    LOG_DIR,
    `${sessionId}.ndjson`,
  );
}

function sameOriginAllowed(req) {
  const origin = req.headers.origin;

  if (!origin) return true;

  try {
    const originHost =
      new URL(origin).host;

    return originHost === req.headers.host;
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > MAX_BODY_BYTES) {
      const error =
        new Error('request body too large');

      error.statusCode = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  const body =
    Buffer.concat(chunks).toString(
      'utf8',
    );

  return JSON.parse(body || '{}');
}

async function handleDebugPost(
  req,
  res,
) {
  if (!sameOriginAllowed(req)) {
    sendJson(res, 403, {
      ok: false,
      error: 'origin rejected',
    });
    return;
  }

  try {
    const payload =
      await readJsonBody(req);

    const sessionId =
      payload?.sessionId;

    const records =
      payload?.records;

    if (
      !isValidSessionId(sessionId) ||
      !Array.isArray(records)
    ) {
      sendJson(res, 400, {
        ok: false,
        error:
          'invalid sessionId or records',
      });
      return;
    }

    const filePath =
      getLogPath(sessionId);

    if (
      existsSync(filePath) &&
      statSync(filePath).size >=
        MAX_SESSION_FILE_BYTES
    ) {
      sendJson(res, 413, {
        ok: false,
        error:
          'session log size limit reached',
      });
      return;
    }

    const lines =
      records
        .map((record) =>
          JSON.stringify(record),
        )
        .join('\n');

    if (lines.length > 0) {
      await appendFile(
        filePath,
        `${lines}\n`,
        'utf8',
      );
    }

    sendJson(res, 200, {
      ok: true,
      sessionId,
      appended: records.length,
    });
  } catch (error) {
    const status =
      Number(error?.statusCode) || 400;

    sendJson(res, status, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

async function handleDebugDownload(
  pathname,
  res,
) {
  const match =
    pathname.match(
      /^\/__mask-debug\/session\/([A-Za-z0-9_-]{16,80})\.ndjson$/,
    );

  if (!match) {
    return false;
  }

  const sessionId = match[1];
  const filePath =
    getLogPath(sessionId);

  if (!existsSync(filePath)) {
    sendJson(res, 404, {
      ok: false,
      error: 'debug session not found',
    });
    return true;
  }

  const stat = statSync(filePath);

  res.writeHead(200, {
    'content-type':
      'application/x-ndjson; charset=utf-8',
    'content-length': stat.size,
    'content-disposition':
      `attachment; filename="mask-debug-${sessionId}.ndjson"`,
    'cache-control': 'no-store',
  });

  createReadStream(filePath).pipe(res);
  return true;
}

function resolveStaticPath(pathname) {
  let relativePath;

  try {
    relativePath =
      decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (
    relativePath === '/' ||
    relativePath === ''
  ) {
    relativePath = '/index.html';
  }

  const normalized =
    path.normalize(relativePath)
      .replace(
        /^(\.\.(\/|\\|$))+/,
        '',
      );

  const absolutePath =
    path.resolve(
      DIST_DIR,
      `.${normalized}`,
    );

  if (
    !absolutePath.startsWith(
      path.resolve(DIST_DIR),
    )
  ) {
    return null;
  }

  return absolutePath;
}

function serveFile(
  filePath,
  res,
  cache = true,
) {
  if (
    !filePath ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    return false;
  }

  const ext =
    path.extname(filePath)
      .toLowerCase();

  const stat =
    statSync(filePath);

  res.writeHead(200, {
    'content-type':
      MIME_TYPES[ext] ||
      'application/octet-stream',
    'content-length': stat.size,
    'cache-control':
      cache
        ? 'public, max-age=3600'
        : 'no-cache',
  });

  createReadStream(filePath).pipe(res);
  return true;
}

const server =
  http.createServer(
    async (req, res) => {
      const url = new URL(
        req.url || '/',
        `http://${req.headers.host || 'localhost'}`,
      );

      if (
        req.method === 'GET' &&
        url.pathname ===
          '/__mask-debug/health'
      ) {
        sendJson(res, 200, {
          ok: true,
          storage: LOG_DIR,
        });
        return;
      }

      if (
        req.method === 'POST' &&
        url.pathname ===
          '/__mask-debug/log'
      ) {
        await handleDebugPost(
          req,
          res,
        );
        return;
      }

      if (req.method === 'GET') {
        if (
          await handleDebugDownload(
            url.pathname,
            res,
          )
        ) {
          return;
        }
      }

      if (
        req.method !== 'GET' &&
        req.method !== 'HEAD'
      ) {
        sendJson(res, 405, {
          ok: false,
          error: 'method not allowed',
        });
        return;
      }

      const requestedPath =
        resolveStaticPath(
          url.pathname,
        );

      if (
        requestedPath &&
        serveFile(
          requestedPath,
          res,
          url.pathname !== '/',
        )
      ) {
        return;
      }

      const indexPath =
        path.join(
          DIST_DIR,
          'index.html',
        );

      if (
        serveFile(
          indexPath,
          res,
          false,
        )
      ) {
        return;
      }

      sendJson(res, 404, {
        ok: false,
        error:
          'frontend build not found',
      });
    },
  );

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `video-town-front listening on ${PORT}`,
    );
    console.log(
      `mask debug logs: ${LOG_DIR}`,
    );
  },
);
