const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "soai-db-test-"));
const dbFile = path.join(tempDir, "db", "soai-db.json");

process.env.NODE_ENV = "production";
process.env.SOAI_DB_FILE = dbFile;
process.env.SOAI_STORAGE_ROOT = path.join(tempDir, "storage");

const { createServer } = require("../src/server");

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await httpRequest(`${baseUrl}/api/student/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "持久化测试学员",
        currentLevel: "基础测试",
        coachName: "测试教练",
        clubName: "SOAI 测试俱乐部"
      })
    });
    assert.strictEqual(res.status, 200);

    assert.ok(fs.existsSync(dbFile), "生产持久化文件应被创建");
    const saved = JSON.parse(fs.readFileSync(dbFile, "utf8"));
    assert.strictEqual(saved.profile.name, "持久化测试学员");
    assert.ok(Array.isArray(saved.reports));
    assert.ok(saved.savedAt);

    console.log("persistence tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function httpRequest(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      headers: options.headers || {}
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
