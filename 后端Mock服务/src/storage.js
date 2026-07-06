const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const STORAGE_ROOT = process.env.SOAI_STORAGE_ROOT || path.join(__dirname, "..", "storage");
const OSS_EXPIRES_SEC = Number(process.env.ALIYUN_OSS_UPLOAD_EXPIRES_SEC || 900);

function ensureStorageRoot() {
  fs.mkdirSync(path.join(STORAGE_ROOT, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(STORAGE_ROOT, "frames"), { recursive: true });
}

function createUploadTarget(video, requestMeta) {
  if (process.env.SOAI_STORAGE_PROVIDER === "aliyun-oss") {
    return createAliyunOssUploadTarget(video);
  }
  ensureStorageRoot();
  const ext = path.extname(video.fileName || "") || ".mp4";
  const storageKey = `uploads/${video.id}${ext}`;
  const storagePath = path.join(STORAGE_ROOT, storageKey);
  return {
    storageProvider: process.env.SOAI_STORAGE_PROVIDER || "local",
    storageKey,
    storagePath,
    storageUrl: toStorageUrl(storageKey),
    uploadUrl: `${getRequestBaseUrl(requestMeta)}${getLocalUploadPathPrefix(requestMeta)}/mock-upload/${video.id}`,
    uploadMethod: "POST",
    expiresInSec: 900
  };
}

function createAliyunOssUploadTarget(video) {
  const bucket = process.env.ALIYUN_OSS_BUCKET || "";
  const endpoint = normalizeOssEndpoint(process.env.ALIYUN_OSS_ENDPOINT || "", process.env.ALIYUN_OSS_REGION || "", bucket);
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || "";
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || "";
  if (!bucket || !endpoint || !accessKeyId || !accessKeySecret) {
    throw new Error("阿里云 OSS 直传未配置完整，请检查 ALIYUN_OSS_BUCKET、ALIYUN_OSS_ENDPOINT/REGION、ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET。");
  }

  const ext = path.extname(video.fileName || "") || ".mp4";
  const storageKey = `uploads/${video.id}${ext}`;
  const expireAt = new Date(Date.now() + OSS_EXPIRES_SEC * 1000).toISOString();
  const maxBytes = Number(process.env.SOAI_MAX_UPLOAD_MB || 150) * 1024 * 1024;
  const policy = Buffer.from(JSON.stringify({
    expiration: expireAt,
    conditions: [
      ["content-length-range", 1, maxBytes],
      ["eq", "$key", storageKey],
      ["starts-with", "$Content-Type", "video/"]
    ]
  })).toString("base64");
  const signature = crypto
    .createHmac("sha1", accessKeySecret)
    .update(policy)
    .digest("base64");
  const uploadUrl = `${endpoint.replace(/\/$/, "")}`;
  const publicBase = (process.env.ALIYUN_OSS_PUBLIC_BASE_URL || uploadUrl).replace(/\/$/, "");

  return {
    storageProvider: "aliyun-oss",
    storageKey,
    storagePath: "",
    storageUrl: `${publicBase}/${storageKey}`,
    uploadUrl,
    uploadMethod: "POST",
    uploadFormData: {
      key: storageKey,
      policy,
      OSSAccessKeyId: accessKeyId,
      signature,
      success_action_status: "200",
      "Content-Type": getVideoContentType(video.fileName)
    },
    expiresInSec: OSS_EXPIRES_SEC
  };
}

function normalizeOssEndpoint(endpoint, region, bucket) {
  if (endpoint) {
    const normalized = endpoint.startsWith("http") ? endpoint : `https://${endpoint}`;
    const url = new URL(normalized);
    if (bucket && (url.hostname === `${region}.aliyuncs.com` || url.hostname.startsWith("oss-"))) {
      return `${url.protocol}//${bucket}.${url.hostname}`;
    }
    return normalized;
  }
  if (!region) return "";
  return bucket ? `https://${bucket}.${region}.aliyuncs.com` : `https://${region}.aliyuncs.com`;
}

function getVideoContentType(fileName = "") {
  return path.extname(fileName).toLowerCase() === ".mov" ? "video/quicktime" : "video/mp4";
}

function getRequestBaseUrl(requestMeta) {
  if (process.env.SOAI_API_PUBLIC_BASE_URL) return process.env.SOAI_API_PUBLIC_BASE_URL;
  const headers = requestMeta && requestMeta.headers ? requestMeta.headers : {};
  const proto = headers["x-forwarded-proto"] || "http";
  const host = headers["x-forwarded-host"] || headers.host || "localhost:8787";
  return `${proto}://${host}`;
}

function getLocalUploadPathPrefix(requestMeta) {
  if (process.env.SOAI_LOCAL_UPLOAD_PATH_PREFIX) return process.env.SOAI_LOCAL_UPLOAD_PATH_PREFIX.replace(/\/$/, "");
  const url = requestMeta && requestMeta.url ? String(requestMeta.url) : "";
  return url.startsWith("/api/lite/v1/") ? "/api/lite/v1" : "";
}

function saveUploadedVideo(video, readable) {
  ensureStorageRoot();
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(chunk));
    readable.on("error", reject);
    readable.on("end", () => {
      const body = Buffer.concat(chunks);
      const payload = extractMultipartFile(body, readable.headers["content-type"]) || body;
      fs.writeFileSync(video.storagePath, payload);
      const stat = fs.statSync(video.storagePath);
      video.uploadStatus = "uploaded";
      video.uploadProgress = 100;
      video.storageUrl = video.storageUrl || toStorageUrl(video.storageKey);
      ensurePlayableLocalVideo(video);
      video.actualSizeMb = Number((stat.size / 1024 / 1024).toFixed(2));
      video.uploadedAt = new Date().toISOString();
      resolve(video);
    });
  });
}

function ensurePlayableLocalVideo(video) {
  if (video.storageProvider !== "local") return;
  if (!video.storagePath || !fs.existsSync(video.storagePath)) return;
  const codec = getVideoCodec(video.storagePath);
  if (!codec || codec === "h264") return;

  const parsed = path.parse(video.storageKey || "");
  const playbackKey = path.join(parsed.dir, `${parsed.name}_playback.mp4`).replace(/\\/g, "/");
  const playbackPath = path.join(STORAGE_ROOT, playbackKey);
  const result = spawnSync("ffmpeg", [
    "-y",
    "-i",
    video.storagePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    playbackPath
  ], { encoding: "utf8" });

  if (result.status !== 0 || !fs.existsSync(playbackPath)) return;
  video.originalStorageKey = video.originalStorageKey || video.storageKey;
  video.originalStoragePath = video.originalStoragePath || video.storagePath;
  video.originalStorageUrl = video.originalStorageUrl || video.storageUrl;
  video.originalVideoCodec = codec;
  video.storageKey = playbackKey;
  video.storagePath = playbackPath;
  video.storageUrl = toStorageUrl(playbackKey);
  video.playbackCodec = "h264";
  video.playbackGeneratedAt = new Date().toISOString();
}

function getVideoCodec(filePath) {
  const result = spawnSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "default=nw=1:nk=1",
    filePath
  ], { encoding: "utf8" });
  if (result.status !== 0) return "";
  return String(result.stdout || "").trim().toLowerCase();
}

function extractMultipartFile(body, contentType = "") {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return null;
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const headerEnd = Buffer.from("\r\n\r\n");
  const firstBoundary = body.indexOf(boundary);
  if (firstBoundary < 0) return null;
  const fileHeaderStart = body.indexOf(headerEnd, firstBoundary);
  if (fileHeaderStart < 0) return null;
  const fileStart = fileHeaderStart + headerEnd.length;
  const nextBoundary = body.indexOf(Buffer.from(`\r\n--${match[1] || match[2]}`), fileStart);
  if (nextBoundary < 0) return null;
  return body.subarray(fileStart, nextBoundary);
}

function buildFramePath(taskId, frameIndex) {
  ensureStorageRoot();
  return path.join(STORAGE_ROOT, "frames", `${taskId}_frame_${String(frameIndex).padStart(4, "0")}.jpg`);
}

function toStorageUrl(storageKey) {
  const baseUrl = process.env.SOAI_STORAGE_PUBLIC_BASE_URL || "local://soai";
  return `${baseUrl}/${storageKey}`;
}

function getStorageFilePath(storageKey = "") {
  const normalized = storageKey.replace(/^\/+/, "");
  const filePath = path.join(STORAGE_ROOT, normalized);
  const rootPath = path.resolve(STORAGE_ROOT);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(rootPath)) return "";
  return resolved;
}

module.exports = {
  STORAGE_ROOT,
  createUploadTarget,
  createAliyunOssUploadTarget,
  saveUploadedVideo,
  buildFramePath,
  toStorageUrl,
  getStorageFilePath
};
