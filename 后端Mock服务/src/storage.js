const fs = require("fs");
const path = require("path");

const STORAGE_ROOT = process.env.SOAI_STORAGE_ROOT || path.join(__dirname, "..", "storage");

function ensureStorageRoot() {
  fs.mkdirSync(path.join(STORAGE_ROOT, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(STORAGE_ROOT, "frames"), { recursive: true });
}

function createUploadTarget(video, requestMeta) {
  ensureStorageRoot();
  const ext = path.extname(video.fileName || "") || ".mp4";
  const storageKey = `uploads/${video.id}${ext}`;
  const storagePath = path.join(STORAGE_ROOT, storageKey);
  return {
    storageProvider: process.env.SOAI_STORAGE_PROVIDER || "local",
    storageKey,
    storagePath,
    storageUrl: toStorageUrl(storageKey),
    uploadUrl: `${getRequestBaseUrl(requestMeta)}/mock-upload/${video.id}`,
    uploadMethod: "POST",
    expiresInSec: 900
  };
}

function getRequestBaseUrl(requestMeta) {
  if (process.env.SOAI_API_PUBLIC_BASE_URL) return process.env.SOAI_API_PUBLIC_BASE_URL;
  const headers = requestMeta && requestMeta.headers ? requestMeta.headers : {};
  const proto = headers["x-forwarded-proto"] || "http";
  const host = headers["x-forwarded-host"] || headers.host || "localhost:8787";
  return `${proto}://${host}`;
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
      video.actualSizeMb = Number((stat.size / 1024 / 1024).toFixed(2));
      video.uploadedAt = new Date().toISOString();
      resolve(video);
    });
  });
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
  saveUploadedVideo,
  buildFramePath,
  toStorageUrl,
  getStorageFilePath
};
