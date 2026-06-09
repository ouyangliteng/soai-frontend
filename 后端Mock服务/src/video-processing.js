const fs = require("fs");
const { spawnSync } = require("child_process");
const { buildFramePath, toStorageUrl } = require("./storage");

const DEFAULT_FPS = Number(process.env.SOAI_FRAME_FPS || 1);

function extractFrames(video, task) {
  const maxDurationSec = Number(process.env.SOAI_MAX_VIDEO_DURATION_SEC || 15);
  const durationSec = clamp(Number(video.durationSec || maxDurationSec), 1, maxDurationSec);
  const fps = clamp(DEFAULT_FPS, 1, 2);
  const targetFrameCount = Math.max(1, Math.round(durationSec * fps));
  const requireRealPose = process.env.SOAI_REQUIRE_REAL_POSE === "true";

  if (video.storagePath && fs.existsSync(video.storagePath) && hasFfmpeg()) {
    const frames = extractWithFfmpeg(video, task, fps, targetFrameCount, durationSec);
    if (frames.length) return frames;
    if (requireRealPose) {
      throw new Error("真实姿态识别抽帧失败，请确认上传视频可播放且服务器 ffmpeg 正常。");
    }
  } else if (requireRealPose) {
    if (!video.storagePath || !fs.existsSync(video.storagePath)) {
      throw new Error("真实姿态识别未找到上传视频文件，请重新上传。");
    }
    throw new Error("真实姿态识别需要服务器安装 ffmpeg 才能抽取视频帧。");
  }

  return buildSyntheticFrames(task, targetFrameCount, durationSec);
}

function extractWithFfmpeg(video, task, fps, targetFrameCount, durationSec) {
  const outputPattern = buildFramePath(task.id, "%04d");
  const result = spawnSync("ffmpeg", [
    "-y",
    "-i",
    video.storagePath,
    "-vf",
    `fps=${fps},scale='min(960,iw)':-2`,
    "-frames:v",
    String(targetFrameCount),
    "-q:v",
    "3",
    "-pix_fmt",
    "yuvj420p",
    outputPattern
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    task.logs.push({
      stage: "extracting_frames",
      level: "warn",
      message: result.stderr || "ffmpeg 抽帧失败，已回退到元数据抽帧。",
      at: new Date().toISOString()
    });
    return [];
  }

  return Array.from({ length: targetFrameCount })
    .map((_, index) => {
      const frameIndex = index + 1;
      const imagePath = buildFramePath(task.id, frameIndex);
      const dimensions = getMediaDimensions(imagePath, 960, 540);
      return {
        frameIndex,
        timestampMs: Math.round((index / fps) * 1000),
        imagePath,
        imageUrl: toStorageUrl(`frames/${task.id}_frame_${String(frameIndex).padStart(4, "0")}.jpg`),
        width: dimensions.width,
        height: dimensions.height,
        extractedBy: "ffmpeg"
      };
    })
    .filter((frame) => fs.existsSync(frame.imagePath));
}

function buildSyntheticFrames(task, frameCount, durationSec) {
  return Array.from({ length: frameCount }).map((_, index) => ({
    frameIndex: index + 1,
    timestampMs: Math.round((index / Math.max(1, frameCount - 1)) * durationSec * 1000),
    imagePath: `synthetic://${task.id}/${index + 1}`,
    imageUrl: `synthetic://${task.id}/${index + 1}`,
    width: 960,
    height: 540,
    extractedBy: "metadata"
  }));
}

function hasFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

function getMediaDimensions(filePath, fallbackWidth, fallbackHeight) {
  const result = spawnSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    filePath
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    return { width: fallbackWidth, height: fallbackHeight };
  }

  const [width, height] = String(result.stdout || "").trim().split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: fallbackWidth, height: fallbackHeight };
  }

  return { width, height };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  extractFrames
};
