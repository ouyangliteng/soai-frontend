const fs = require("fs");
const { spawnSync } = require("child_process");
const { buildFramePath, toStorageUrl } = require("./storage");

const DEFAULT_FPS = Number(process.env.SOAI_FRAME_FPS || 1);

function extractFrames(video, task) {
  const maxDurationSec = Number(process.env.SOAI_MAX_VIDEO_DURATION_SEC || 15);
  const durationSec = clamp(Number(video.durationSec || 10), 10, maxDurationSec);
  const fps = clamp(DEFAULT_FPS, 1, 2);
  const targetFrameCount = Math.max(1, Math.round(durationSec * fps));

  if (video.storagePath && fs.existsSync(video.storagePath) && hasFfmpeg()) {
    const frames = extractWithFfmpeg(video, task, fps, targetFrameCount, durationSec);
    if (frames.length) return frames;
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
      return {
        frameIndex,
        timestampMs: Math.round((index / fps) * 1000),
        imagePath,
        imageUrl: toStorageUrl(`frames/${task.id}_frame_${String(frameIndex).padStart(4, "0")}.jpg`),
        width: 960,
        height: 540,
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

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  extractFrames
};
