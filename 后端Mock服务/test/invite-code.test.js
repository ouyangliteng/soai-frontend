const assert = require("assert");
const http = require("http");
const { createServer } = require("../src/server");

async function main() {
  process.env.SOAI_LITE_INVITE_CODES = "SOAI-PUBLIC-01,SOAI-PUBLIC-02";
  process.env.SOAI_LITE_INTERNAL_INVITE_CODE = "SOAI2026";
  process.env.SOAI_LITE_INVITE_MAX_USERS = "20";
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const firstLogin = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "first-user",
      anonymousId: "public-user-a"
    });
    const firstHeaders = { Authorization: `Bearer ${firstLogin.token}` };
    const firstInvite = await request(baseUrl, "POST", "/api/lite/v1/invite/verify", {
      inviteCode: "SOAI-PUBLIC-01"
    }, firstHeaders);
    assert.strictEqual(firstInvite.success, true);
    assert.strictEqual(firstInvite.inviteAccess.acceptedUsers, 1);

    const secondLogin = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "second-user",
      anonymousId: "public-user-b"
    });
    const secondHeaders = { Authorization: `Bearer ${secondLogin.token}` };
    const reusedPublicCode = await request(baseUrl, "POST", "/api/lite/v1/invite/verify", {
      inviteCode: "SOAI-PUBLIC-01"
    }, secondHeaders, { allowError: true });
    assert.strictEqual(reusedPublicCode.statusCode, 403);
    assert.strictEqual(reusedPublicCode.body.code, "INVITE_CODE_USED");

    const internalInvite = await request(baseUrl, "POST", "/api/lite/v1/invite/verify", {
      inviteCode: "SOAI2026"
    }, secondHeaders);
    assert.strictEqual(internalInvite.success, true);
    assert.strictEqual(internalInvite.inviteAccess.acceptedUsers, 1);

    console.log("invite code tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function request(baseUrl, method, path, body, headers = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${path}`);
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const parsed = text ? JSON.parse(text) : {};
        if (res.statusCode >= 400 && !options.allowError) {
          reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          return;
        }
        if (options.allowError) {
          resolve({ statusCode: res.statusCode, body: parsed });
          return;
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
