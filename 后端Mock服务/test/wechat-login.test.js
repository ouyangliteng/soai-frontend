const assert = require("assert");
const http = require("http");
const { createServer } = require("../src/server");

async function main() {
  process.env.WECHAT_MINI_APP_ID = "wx-test-appid";
  process.env.WECHAT_MINI_APP_SECRET = "wx-test-secret";
  process.env.SOAI_WECHAT_LOGIN_ALLOW_MOCK = "false";

  const fakeWechat = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    assert.strictEqual(url.searchParams.get("appid"), "wx-test-appid");
    assert.strictEqual(url.searchParams.get("secret"), "wx-test-secret");
    assert.strictEqual(url.searchParams.get("grant_type"), "authorization_code");

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    if (url.searchParams.get("js_code") === "bad-code") {
      res.end(JSON.stringify({ errcode: 40029, errmsg: "invalid code" }));
      return;
    }
    res.end(JSON.stringify({
      openid: "openid_soai_lite_001",
      unionid: "unionid_soai_lite_001",
      session_key: "session-key-must-stay-server-side"
    }));
  });
  await new Promise((resolve) => fakeWechat.listen(0, resolve));
  const fakeWechatPort = fakeWechat.address().port;
  process.env.WECHAT_CODE2SESSION_URL = `http://127.0.0.1:${fakeWechatPort}/sns/jscode2session`;

  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const login = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "real-code-1",
      anonymousId: "local-anonymous-id",
      name: "微信真实用户"
    });
    assert.strictEqual(login.authMode, "wechat_code2session");
    assert.ok(login.token.startsWith("lite_student_lite_"));
    assert.strictEqual(login.profile.name, "微信真实用户");
    assert.ok(login.profile.wxOpenIdHash);
    assert.ok(login.profile.wxUnionIdHash);
    assert.strictEqual(login.profile.wxOpenId, undefined);
    assert.strictEqual(login.session_key, undefined);

    const headers = { Authorization: `Bearer ${login.token}` };
    await request(baseUrl, "POST", "/api/lite/v1/student/profile", {
      name: "保留资料名",
      currentLevel: "初级进阶"
    }, headers);

    const relogin = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "real-code-2",
      anonymousId: "another-local-id"
    });
    assert.strictEqual(relogin.token, login.token);
    assert.strictEqual(relogin.profile.name, "保留资料名");

    const failed = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "bad-code"
    }, {}, { allowError: true });
    assert.strictEqual(failed.statusCode, 401);
    assert.strictEqual(failed.body.code, "WECHAT_LOGIN_FAILED");

    process.env.SOAI_WECHAT_LOGIN_ALLOW_MOCK = "true";
    process.env.SOAI_WECHAT_LOGIN_ALLOW_MOCK_ON_ERROR = "true";
    const mockFallback = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "bad-code",
      anonymousId: "mock-fallback-user"
    });
    assert.strictEqual(mockFallback.authMode, "mock_code2session_error");
    assert.ok(mockFallback.token.startsWith("lite_student_lite_"));

    process.env.NODE_ENV = "production";
    const productionMockBlocked = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "bad-code",
      anonymousId: "production-mock-blocked"
    }, {}, { allowError: true });
    assert.strictEqual(productionMockBlocked.statusCode, 401);
    assert.strictEqual(productionMockBlocked.body.code, "WECHAT_LOGIN_FAILED");

    console.log("wechat login tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => fakeWechat.close(resolve));
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
