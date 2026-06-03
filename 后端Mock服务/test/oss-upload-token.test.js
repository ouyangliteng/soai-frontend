const assert = require("assert");

process.env.SOAI_STORAGE_PROVIDER = "aliyun-oss";
process.env.ALIYUN_OSS_BUCKET = "soai-test-bucket";
process.env.ALIYUN_OSS_REGION = "oss-cn-hangzhou";
process.env.ALIYUN_OSS_ENDPOINT = "https://soai-test-bucket.oss-cn-hangzhou.aliyuncs.com";
process.env.ALIYUN_OSS_PUBLIC_BASE_URL = "https://cdn.soai.test";
process.env.ALIYUN_ACCESS_KEY_ID = "test-access-key-id";
process.env.ALIYUN_ACCESS_KEY_SECRET = "test-access-key-secret";

const { createUploadTarget } = require("../src/storage");

const target = createUploadTarget({
  id: "video_oss_contract",
  fileName: "training.mp4"
});

assert.strictEqual(target.storageProvider, "aliyun-oss");
assert.strictEqual(target.uploadMethod, "POST");
assert.strictEqual(target.uploadUrl, "https://soai-test-bucket.oss-cn-hangzhou.aliyuncs.com");
assert.strictEqual(target.storageKey, "uploads/video_oss_contract.mp4");
assert.strictEqual(target.storageUrl, "https://cdn.soai.test/uploads/video_oss_contract.mp4");
assert.strictEqual(target.uploadFormData.key, target.storageKey);
assert.strictEqual(target.uploadFormData.OSSAccessKeyId, "test-access-key-id");
assert.strictEqual(target.uploadFormData["Content-Type"], "video/mp4");
assert.ok(target.uploadFormData.policy);
assert.ok(target.uploadFormData.signature);

const policy = JSON.parse(Buffer.from(target.uploadFormData.policy, "base64").toString("utf8"));
assert.ok(policy.expiration);
assert.ok(policy.conditions.some((item) => Array.isArray(item) && item[0] === "eq" && item[1] === "$key" && item[2] === target.storageKey));

process.env.ALIYUN_OSS_ENDPOINT = "https://oss-cn-hangzhou.aliyuncs.com";
const regionalTarget = createUploadTarget({
  id: "video_oss_region_contract",
  fileName: "training.mov"
});
assert.strictEqual(regionalTarget.uploadUrl, "https://soai-test-bucket.oss-cn-hangzhou.aliyuncs.com");
assert.strictEqual(regionalTarget.uploadFormData["Content-Type"], "video/quicktime");

console.log("oss upload token tests passed");
