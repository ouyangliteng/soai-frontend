const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { STORAGE_ROOT, toStorageUrl } = require("./storage");

const PYTHON_RENDERER = String.raw`
import json
import math
import sys

import cv2
import numpy as np

POINT_MIN_CONFIDENCE = 0.3
WHITE = (246, 255, 252)
RED = (36, 58, 255)
BLUE = (255, 148, 52)
GREEN = (82, 242, 94)
YELLOW = (0, 214, 255)

LINE_PAIRS = [
    ("head", "shoulder", "neck"),
    ("shoulder", "waist", "torso"),
    ("shoulder", "elbow", "arm"),
    ("elbow", "wrist", "arm"),
    ("waist", "knee", "leg"),
    ("knee", "foot", "leg"),
]
SEGMENT_COLORS = {
    "neck": RED,
    "torso": BLUE,
    "arm": GREEN,
    "leg": YELLOW,
}


def is_visible(point):
    return point and float(point.get("confidence", 0)) >= POINT_MIN_CONFIDENCE


def clone_point(point):
    return {
        "x": float(point["x"]),
        "y": float(point["y"]),
        "confidence": float(point.get("confidence", 0)),
        "derived": bool(point.get("derived")),
    }


def average(points):
    visible = [point for point in points if is_visible(point)]
    if not visible:
        return None
    return {
        "x": sum(float(point["x"]) for point in visible) / len(visible),
        "y": sum(float(point["y"]) for point in visible) / len(visible),
        "confidence": sum(float(point.get("confidence", 0)) for point in visible) / len(visible),
        "derived": any(bool(point.get("derived")) for point in visible),
    }


def interpolate_point(left, right, progress):
    if is_visible(left) and is_visible(right):
        return {
            "x": float(left["x"]) + (float(right["x"]) - float(left["x"])) * progress,
            "y": float(left["y"]) + (float(right["y"]) - float(left["y"])) * progress,
            "confidence": min(float(left.get("confidence", 0)), float(right.get("confidence", 0))),
            "derived": bool(left.get("derived") or right.get("derived")),
        }
    if is_visible(left):
        return clone_point(left)
    if is_visible(right):
        return clone_point(right)
    return None


def side_score(frames, side):
    names = [f"{side}Shoulder", f"{side}Elbow", f"{side}Wrist", f"{side}Knee", f"{side}Heel", f"{side}Toe"]
    values = []
    for frame in frames:
        points = frame.get("points") or {}
        for name in names:
            point = points.get(name)
            if point:
                values.append(float(point.get("confidence", 0)))
    return sum(values) / len(values) if values else 0


def select_visible_side(frames):
    left_score = side_score(frames, "left")
    right_score = side_score(frames, "right")
    return "left" if left_score >= right_score else "right"


def overlay_points(frame, side):
    points = frame.get("points") or {}
    other = "right" if side == "left" else "left"
    shoulder = points.get(f"{side}Shoulder") or points.get(f"{other}Shoulder")
    elbow = points.get(f"{side}Elbow") or points.get(f"{other}Elbow")
    wrist = points.get(f"{side}Wrist") or points.get(f"{other}Wrist")
    knee = points.get(f"{side}Knee") or points.get(f"{other}Knee")
    foot = average([points.get(f"{side}Heel"), points.get(f"{side}Toe")]) or average([points.get(f"{other}Heel"), points.get(f"{other}Toe")])
    return {
        "head": points.get("head"),
        "shoulder": shoulder,
        "elbow": elbow,
        "wrist": wrist,
        "waist": average([points.get("leftHip"), points.get("rightHip"), points.get("waist")]),
        "knee": knee,
        "foot": foot,
    }


def interpolated_frame(frames, time_ms):
    if not frames:
        return {"timeMs": time_ms, "points": {}}
    frames = sorted(frames, key=lambda item: float(item.get("timeMs", 0)))
    if time_ms <= float(frames[0].get("timeMs", 0)):
        return frames[0]
    if time_ms >= float(frames[-1].get("timeMs", 0)):
        return frames[-1]
    next_index = 1
    while next_index < len(frames) and float(frames[next_index].get("timeMs", 0)) < time_ms:
        next_index += 1
    left = frames[next_index - 1]
    right = frames[next_index]
    left_time = float(left.get("timeMs", 0))
    right_time = float(right.get("timeMs", left_time + 1))
    progress = max(0, min(1, (time_ms - left_time) / max(1, right_time - left_time)))
    keys = set((left.get("points") or {}).keys()) | set((right.get("points") or {}).keys())
    points = {}
    for key in keys:
        point = interpolate_point((left.get("points") or {}).get(key), (right.get("points") or {}).get(key), progress)
        if point:
            points[key] = point
    return {
        "timeMs": time_ms,
        "sourceWidth": left.get("sourceWidth") or right.get("sourceWidth"),
        "sourceHeight": left.get("sourceHeight") or right.get("sourceHeight"),
        "points": points,
    }


def pixel(point, width, height):
    return (int(max(0, min(1, float(point["x"]))) * width), int(max(0, min(1, float(point["y"]))) * height))


def draw_pose(image, points, width, height):
    glow = image.copy()
    for left_key, right_key, segment in LINE_PAIRS:
        left = points.get(left_key)
        right = points.get(right_key)
        if is_visible(left) and is_visible(right):
            cv2.line(glow, pixel(left, width, height), pixel(right, width, height), SEGMENT_COLORS[segment], 18, cv2.LINE_AA)
    cv2.addWeighted(glow, 0.36, image, 0.64, 0, image)

    for left_key, right_key, segment in LINE_PAIRS:
        left = points.get(left_key)
        right = points.get(right_key)
        if is_visible(left) and is_visible(right):
            cv2.line(image, pixel(left, width, height), pixel(right, width, height), SEGMENT_COLORS[segment], 6, cv2.LINE_AA)

    for point in points.values():
        if not is_visible(point):
            continue
        center = pixel(point, width, height)
        cv2.circle(image, center, 12, WHITE, -1, cv2.LINE_AA)
        cv2.circle(image, center, 7, WHITE, -1, cv2.LINE_AA)
        cv2.circle(image, center, 4, (245, 245, 245), -1, cv2.LINE_AA)


def main():
    input_video, pose_json, output_video = sys.argv[1:4]
    with open(pose_json, "r", encoding="utf-8") as file:
        pose_track = json.load(file)
    frames = pose_track.get("frames") or []
    selected_side = select_visible_side(frames)
    cap = cv2.VideoCapture(input_video)
    if not cap.isOpened():
        raise RuntimeError("cannot open input video")
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if width <= 0 or height <= 0:
        raise RuntimeError("invalid input video size")
    writer = cv2.VideoWriter(output_video, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError("cannot open output video writer")
    index = 0
    while True:
        ok, image = cap.read()
        if not ok:
            break
        time_ms = index * 1000.0 / fps
        pose_frame = interpolated_frame(frames, time_ms)
        draw_pose(image, overlay_points(pose_frame, selected_side), width, height)
        writer.write(image)
        index += 1
    cap.release()
    writer.release()


if __name__ == "__main__":
    main()
`;

function renderPoseOverlayVideo(video, poseTrack) {
  if (process.env.SOAI_POSE_OVERLAY_VIDEO_ENABLED === "false") return null;
  const inputVideoPath = getInputVideoPath(video);
  if (!video || video.storageProvider !== "local" || !inputVideoPath) return null;
  if (!poseTrack || !Array.isArray(poseTrack.frames) || poseTrack.frames.length === 0) return null;

  const overlayDir = path.join(STORAGE_ROOT, "overlays");
  const uploadDir = path.join(STORAGE_ROOT, "uploads");
  fs.mkdirSync(overlayDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  const poseJsonPath = path.join(overlayDir, `${video.id}_pose_track.json`);
  const rawPath = path.join(overlayDir, `${video.id}_pose_raw.mp4`);
  const finalKey = `uploads/${video.id}_pose_overlay_${Date.now()}.mp4`;
  const finalPath = path.join(STORAGE_ROOT, finalKey);
  fs.writeFileSync(poseJsonPath, JSON.stringify(poseTrack));

  const rendered = runPythonRenderer(inputVideoPath, poseJsonPath, rawPath);
  if (!rendered || !fs.existsSync(rawPath)) return null;

  const converted = spawnSync("ffmpeg", [
    "-y",
    "-i",
    rawPath,
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
    finalPath
  ], { encoding: "utf8" });
  if (converted.status !== 0 || !fs.existsSync(finalPath)) return null;

  return {
    storageKey: finalKey,
    storagePath: finalPath,
    storageUrl: toStorageUrl(finalKey)
  };
}

function getInputVideoPath(video) {
  if (!video) return "";
  if (video.storagePath && fs.existsSync(video.storagePath)) return video.storagePath;
  if (video.storageKey) {
    const storageKeyPath = path.join(STORAGE_ROOT, video.storageKey);
    if (fs.existsSync(storageKeyPath)) return storageKeyPath;
    const parsed = path.parse(video.storageKey);
    const playbackPath = path.join(STORAGE_ROOT, parsed.dir, `${parsed.name}_playback.mp4`);
    if (fs.existsSync(playbackPath)) return playbackPath;
  }
  return "";
}

function runPythonRenderer(inputVideo, poseJsonPath, rawPath) {
  const local = spawnSync("python3", ["-", inputVideo, poseJsonPath, rawPath], {
    input: PYTHON_RENDERER,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10
  });
  if (local.status === 0) return true;
  if (process.env.SOAI_POSE_OVERLAY_CONTAINER === "disabled") return false;

  const containerName = process.env.SOAI_POSE_OVERLAY_CONTAINER || "soai-pose-service";
  const docker = spawnSync("docker", ["exec", "-i", containerName, "python", "-", inputVideo, poseJsonPath, rawPath], {
    input: PYTHON_RENDERER,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10
  });
  return docker.status === 0;
}

module.exports = {
  renderPoseOverlayVideo
};
