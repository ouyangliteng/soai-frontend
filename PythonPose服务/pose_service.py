#!/usr/bin/env python3
"""SOAI Python Pose Service.

This service is the model boundary between video frame extraction and the Node
equestrian rule engine. It exposes a stable JSON contract that can be backed by
YOLO-Pose, RTMPose, or a deterministic synthetic provider for local development.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse


KEYPOINT_NAMES = [
    "nose",
    "leftShoulder",
    "rightShoulder",
    "leftElbow",
    "rightElbow",
    "leftWrist",
    "rightWrist",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftAnkle",
    "rightAnkle",
]

COCO_TO_SOAI = {
    "nose": "nose",
    "left_shoulder": "leftShoulder",
    "right_shoulder": "rightShoulder",
    "left_elbow": "leftElbow",
    "right_elbow": "rightElbow",
    "left_wrist": "leftWrist",
    "right_wrist": "rightWrist",
    "left_hip": "leftHip",
    "right_hip": "rightHip",
    "left_knee": "leftKnee",
    "right_knee": "rightKnee",
    "left_ankle": "leftAnkle",
    "right_ankle": "rightAnkle",
}

COCO_ORDER = [
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]

PROVIDER_CACHE: Dict[str, Any] = {}


class PoseError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def point(x: float, y: float, confidence: float) -> Dict[str, float]:
    return {
        "x": round(float(x), 2),
        "y": round(float(y), 2),
        "confidence": round(float(confidence), 3),
    }


def average(values: Iterable[float]) -> float:
    clean = [value for value in values if isinstance(value, (int, float)) and math.isfinite(value)]
    if not clean:
        return 0.0
    return round(sum(clean) / len(clean), 3)


def normalize_frame(raw: Dict[str, Any], index: int) -> Dict[str, Any]:
    frame = dict(raw)
    frame.setdefault("frameIndex", index + 1)
    frame.setdefault("timestampMs", 0)
    frame.setdefault("width", 960)
    frame.setdefault("height", 540)
    return frame


def read_image_bytes(frame: Dict[str, Any]) -> Optional[bytes]:
    image_base64 = frame.get("imageBase64")
    if image_base64:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        return base64.b64decode(image_base64)

    image_path = frame.get("imagePath")
    if image_path and not str(image_path).startswith("synthetic://"):
        path = Path(str(image_path))
        if path.exists() and path.is_file():
            return path.read_bytes()
    return None


def build_synthetic_pose(phase: float, width: int, height: int) -> Dict[str, Dict[str, float]]:
    sway = math.sin(phase * math.pi * 4)
    turn = 18 if phase > 0.58 else 0
    torso_lean = 30 + sway * 10
    ankle_drift = 28 + math.cos(phase * math.pi * 6) * 20
    base_x = width * 0.52
    base_y = height * 0.28
    return {
        "nose": point(base_x + turn, base_y - 42, 0.82),
        "leftShoulder": point(base_x - 28 + torso_lean, base_y + 18, 0.86),
        "rightShoulder": point(base_x + 28 + torso_lean, base_y + 20, 0.84),
        "leftElbow": point(base_x - 50, base_y + 95, 0.78),
        "rightElbow": point(base_x + 2, base_y + 95, 0.8),
        "leftWrist": point(base_x - 88, base_y + 146, 0.76),
        "rightWrist": point(base_x - 24, base_y + 145, 0.78),
        "leftHip": point(base_x - 22, base_y + 178, 0.86),
        "rightHip": point(base_x + 28, base_y + 178, 0.85),
        "leftKnee": point(base_x - 44, base_y + 278, 0.75),
        "rightKnee": point(base_x + 26, base_y + 282, 0.76),
        "leftAnkle": point(base_x - 52 - ankle_drift, base_y + 402, 0.7),
        "rightAnkle": point(base_x + 24 - ankle_drift * 0.4, base_y + 404, 0.72),
    }


class SyntheticProvider:
    name = "synthetic"

    def detect(self, frames: List[Dict[str, Any]], payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        results = []
        for index, raw in enumerate(frames):
            frame = normalize_frame(raw, index)
            phase = index / max(1, len(frames) - 1)
            keypoints = build_synthetic_pose(phase, int(frame["width"]), int(frame["height"]))
            results.append(build_pose_frame(frame, keypoints, self.name, "soai-synthetic-v1"))
        return results


class YoloPoseProvider:
    name = "yolo-pose"

    def __init__(self, model_ref: str):
        if not model_ref:
            raise PoseError("YOLO_MODEL_REQUIRED", "请设置 YOLO_POSE_MODEL_PATH，例如 yolo11n-pose.pt。", 503)
        try:
            from ultralytics import YOLO  # type: ignore
        except Exception as exc:
            raise PoseError(
                "YOLO_DEPENDENCY_MISSING",
                "未安装 ultralytics，无法启动 YOLO-Pose provider。",
                503,
            ) from exc
        self.model_ref = model_ref
        self.model = YOLO(model_ref)

    def detect(self, frames: List[Dict[str, Any]], payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        results = []
        for index, raw in enumerate(frames):
            frame = normalize_frame(raw, index)
            image = read_image_bytes(frame)
            if not image:
                raise PoseError("FRAME_IMAGE_REQUIRED", "YOLO-Pose 需要 imagePath 或 imageBase64。", 422)
            pose = self._detect_one(image, frame)
            results.append(pose)
        return results

    def _detect_one(self, image: bytes, frame: Dict[str, Any]) -> Dict[str, Any]:
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
            tmp.write(image)
            tmp.flush()
            predictions = self.model(tmp.name, verbose=False)
        candidates = []
        for result in predictions:
            keypoints = getattr(result, "keypoints", None)
            if keypoints is None or keypoints.xy is None or len(keypoints.xy) == 0:
                continue
            xy = keypoints.xy.cpu().numpy()
            conf = keypoints.conf.cpu().numpy() if keypoints.conf is not None else None
            boxes = getattr(result, "boxes", None)
            box_xyxy = boxes.xyxy.cpu().numpy() if boxes is not None and getattr(boxes, "xyxy", None) is not None else None
            for person_index, person_xy in enumerate(xy):
                person_conf = conf[person_index] if conf is not None else [0.5] * len(person_xy)
                bbox = box_xyxy[person_index] if box_xyxy is not None and person_index < len(box_xyxy) else None
                candidates.append({
                    "xy": person_xy,
                    "confidence": person_conf,
                    "bbox": bbox,
                    "frameWidth": frame.get("width"),
                    "frameHeight": frame.get("height"),
                })
        keypoints = best_coco_pose_to_soai(candidates)
        return build_pose_frame(frame, keypoints, self.name, model_display_name(self.model_ref))


class RtmposeProvider:
    name = "rtmpose"

    def __init__(self, config_path: str, checkpoint_path: str):
        if not config_path or not checkpoint_path:
            raise PoseError("RTMPOSE_MODEL_REQUIRED", "请设置 RTMPOSE_CONFIG_PATH 和 RTMPOSE_CHECKPOINT_PATH。", 503)
        try:
            from mmpose.apis import inference_topdown, init_model  # type: ignore
        except Exception as exc:
            raise PoseError(
                "RTMPOSE_DEPENDENCY_MISSING",
                "未安装 mmpose/mmcv，无法启动 RTMPose provider。",
                503,
            ) from exc
        self.config_path = config_path
        self.checkpoint_path = checkpoint_path
        self.inference_topdown = inference_topdown
        self.model = init_model(config_path, checkpoint_path, device=os.getenv("RTMPOSE_DEVICE", "cpu"))

    def detect(self, frames: List[Dict[str, Any]], payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        results = []
        for index, raw in enumerate(frames):
            frame = normalize_frame(raw, index)
            image = read_image_bytes(frame)
            if not image:
                raise PoseError("FRAME_IMAGE_REQUIRED", "RTMPose 需要 imagePath 或 imageBase64。", 422)
            results.append(self._detect_one(image, frame))
        return results

    def _detect_one(self, image: bytes, frame: Dict[str, Any]) -> Dict[str, Any]:
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
            tmp.write(image)
            tmp.flush()
            predictions = self.inference_topdown(self.model, tmp.name)
        if not predictions:
            keypoints = empty_keypoints()
        else:
            candidates = [
                (
                    item.pred_instances.keypoints[0],
                    item.pred_instances.keypoint_scores[0],
                )
                for item in predictions
            ]
            keypoints = best_coco_pose_to_soai(candidates)
        return build_pose_frame(frame, keypoints, self.name, Path(self.checkpoint_path).name)


def empty_keypoints() -> Dict[str, Dict[str, float]]:
    return {name: point(0, 0, 0) for name in KEYPOINT_NAMES}


def coco_points_to_soai(xy: Any, confidence: Any) -> Dict[str, Dict[str, float]]:
    keypoints = empty_keypoints()
    for index, coco_name in enumerate(COCO_ORDER):
        soai_name = COCO_TO_SOAI.get(coco_name)
        if not soai_name or index >= len(xy):
            continue
        keypoints[soai_name] = point(float(xy[index][0]), float(xy[index][1]), float(confidence[index]))
    return keypoints


def unpack_pose_candidate(candidate: Any) -> Dict[str, Any]:
    if isinstance(candidate, dict):
        xy = candidate.get("xy")
        confidence = candidate.get("confidence")
        return {
            "xy": xy if xy is not None else [],
            "confidence": confidence if confidence is not None else [],
            "bbox": candidate.get("bbox"),
            "frameWidth": candidate.get("frameWidth"),
            "frameHeight": candidate.get("frameHeight"),
        }
    xy, confidence = candidate
    return {"xy": xy, "confidence": confidence, "bbox": None, "frameWidth": None, "frameHeight": None}


def pose_candidate_score(candidate: Dict[str, Any]) -> float:
    xy = candidate["xy"]
    confidence = candidate["confidence"]
    if len(xy) < len(COCO_ORDER):
        return -1.0

    soai = coco_points_to_soai(xy, confidence)
    required = [
        "nose",
        "leftShoulder",
        "rightShoulder",
        "leftHip",
        "rightHip",
        "leftKnee",
        "rightKnee",
        "leftAnkle",
        "rightAnkle",
    ]
    visible = [soai[name] for name in required if soai[name]["confidence"] >= 0.25]
    torso = [soai[name] for name in ["leftShoulder", "rightShoulder", "leftHip", "rightHip"]]
    leg_count = len([soai[name] for name in ["leftKnee", "rightKnee", "leftAnkle", "rightAnkle"] if soai[name]["confidence"] >= 0.25])
    head_shoulder_count = len([soai[name] for name in ["nose", "leftShoulder", "rightShoulder"] if soai[name]["confidence"] >= 0.25])

    confidence_score = average([item["confidence"] for item in visible])
    completeness_score = len(visible) / len(required)
    torso_score = len([item for item in torso if item["confidence"] >= 0.25]) / len(torso)
    leg_score = leg_count / 4
    head_shoulder_score = head_shoulder_count / 3

    bbox_score = 0.0
    bbox = candidate.get("bbox")
    frame_width = float(candidate.get("frameWidth") or 0)
    frame_height = float(candidate.get("frameHeight") or 0)
    if bbox is not None and len(bbox) >= 4 and frame_width > 0 and frame_height > 0:
        x1, y1, x2, y2 = [float(value) for value in bbox[:4]]
        width_ratio = max(0.0, min(1.0, (x2 - x1) / frame_width))
        height_ratio = max(0.0, min(1.0, (y2 - y1) / frame_height))
        area_ratio = width_ratio * height_ratio
        bbox_score = min(1.0, area_ratio / 0.12)

    return (
        confidence_score * 0.45
        + completeness_score * 0.22
        + torso_score * 0.14
        + leg_score * 0.10
        + head_shoulder_score * 0.06
        + bbox_score * 0.03
    )


def best_coco_pose_to_soai(candidates: Iterable[Any]) -> Dict[str, Dict[str, float]]:
    best_candidate = None
    best_score = -1.0
    for raw_candidate in candidates:
        candidate = unpack_pose_candidate(raw_candidate)
        score = pose_candidate_score(candidate)
        if score > best_score:
            best_score = score
            best_candidate = candidate
    if best_candidate is None:
        return empty_keypoints()
    return coco_points_to_soai(best_candidate["xy"], best_candidate["confidence"])


def build_pose_frame(
    frame: Dict[str, Any],
    keypoints: Dict[str, Dict[str, float]],
    provider: str,
    model_name: str,
) -> Dict[str, Any]:
    pose_confidence = average([item.get("confidence", 0) for item in keypoints.values()])
    return {
        "frameIndex": frame["frameIndex"],
        "timestampMs": frame.get("timestampMs", 0),
        "keypoints": keypoints,
        "poseConfidence": pose_confidence,
        "visibilityQuality": "usable" if pose_confidence >= 0.72 else "low",
        "provider": provider,
        "modelName": model_name,
    }


def build_provider(name: str):
    normalized = normalize_provider_name(name)
    cache_key = provider_cache_key(normalized)
    if cache_key in PROVIDER_CACHE:
        return PROVIDER_CACHE[cache_key]
    if normalized == "synthetic":
        provider = SyntheticProvider()
    elif normalized == "yolo-pose":
        provider = YoloPoseProvider(os.getenv("YOLO_POSE_MODEL_PATH", ""))
    elif normalized == "rtmpose":
        provider = RtmposeProvider(os.getenv("RTMPOSE_CONFIG_PATH", ""), os.getenv("RTMPOSE_CHECKPOINT_PATH", ""))
    else:
        raise PoseError("POSE_PROVIDER_UNSUPPORTED", f"不支持的 provider：{name}", 400)
    PROVIDER_CACHE[cache_key] = provider
    return provider


def normalize_provider_name(name: str) -> str:
    value = str(name or "synthetic").lower()
    if value in {"synthetic", "mock"}:
        return "synthetic"
    if value in {"yolo", "yolo-pose", "yolopose"}:
        return "yolo-pose"
    if value in {"rtmpose", "rtm-pose"}:
        return "rtmpose"
    return value


def provider_cache_key(name: str) -> str:
    if name == "yolo-pose":
        return f"{name}:{os.getenv('YOLO_POSE_MODEL_PATH', '')}"
    if name == "rtmpose":
        return f"{name}:{os.getenv('RTMPOSE_CONFIG_PATH', '')}:{os.getenv('RTMPOSE_CHECKPOINT_PATH', '')}:{os.getenv('RTMPOSE_DEVICE', 'cpu')}"
    return name


def model_display_name(model_ref: str) -> str:
    if "/" in model_ref or "\\" in model_ref:
        return Path(model_ref).name
    return model_ref


def path_status(path_value: str, allow_model_name: bool = False) -> Dict[str, Any]:
    if not path_value:
        return {"configured": False, "exists": False, "value": ""}
    if allow_model_name and "/" not in path_value and "\\" not in path_value:
        return {"configured": True, "exists": None, "value": path_value, "note": "模型名称将由 Ultralytics 解析或下载。"}
    path = Path(path_value)
    return {"configured": True, "exists": path.exists(), "value": path_value}


def provider_status(name: Optional[str] = None, load: bool = False) -> Dict[str, Any]:
    provider_name = normalize_provider_name(name or os.getenv("POSE_PROVIDER", "synthetic"))
    status: Dict[str, Any] = {
        "provider": provider_name,
        "ready": True,
        "loadable": None,
        "cached": provider_cache_key(provider_name) in PROVIDER_CACHE,
        "missing": [],
        "config": {},
    }
    if provider_name == "synthetic":
        status["config"] = {"modelName": "soai-synthetic-v1"}
    elif provider_name == "yolo-pose":
        model_state = path_status(os.getenv("YOLO_POSE_MODEL_PATH", ""), allow_model_name=True)
        status["config"] = {"model": model_state}
        if not model_state["configured"]:
            status["ready"] = False
            status["missing"].append("YOLO_POSE_MODEL_PATH")
        if model_state["exists"] is False:
            status["ready"] = False
            status["missing"].append("YOLO_POSE_MODEL_PATH file")
    elif provider_name == "rtmpose":
        config_state = path_status(os.getenv("RTMPOSE_CONFIG_PATH", ""))
        checkpoint_state = path_status(os.getenv("RTMPOSE_CHECKPOINT_PATH", ""))
        status["config"] = {
            "config": config_state,
            "checkpoint": checkpoint_state,
            "device": os.getenv("RTMPOSE_DEVICE", "cpu"),
        }
        if not config_state["configured"]:
            status["ready"] = False
            status["missing"].append("RTMPOSE_CONFIG_PATH")
        if not checkpoint_state["configured"]:
            status["ready"] = False
            status["missing"].append("RTMPOSE_CHECKPOINT_PATH")
        if config_state["exists"] is False:
            status["ready"] = False
            status["missing"].append("RTMPOSE_CONFIG_PATH file")
        if checkpoint_state["exists"] is False:
            status["ready"] = False
            status["missing"].append("RTMPOSE_CHECKPOINT_PATH file")
    else:
        status["ready"] = False
        status["missing"].append("supported provider")

    if load:
        try:
            build_provider(provider_name)
            status["loadable"] = True
            status["cached"] = True
        except PoseError as exc:
            status["loadable"] = False
            status["ready"] = False
            status["loadError"] = {"code": exc.code, "message": exc.message}
    return status


def handle_detect(payload: Dict[str, Any]) -> Dict[str, Any]:
    frames = payload.get("frames")
    if not isinstance(frames, list) or not frames:
        raise PoseError("FRAMES_REQUIRED", "frames 必须是非空数组。", 400)
    provider_name = normalize_provider_name(str(payload.get("provider") or os.getenv("POSE_PROVIDER", "synthetic")))
    provider = build_provider(provider_name)
    started = time.time()
    pose_frames = provider.detect(frames, payload)
    return {
        "success": True,
        "taskId": payload.get("taskId", ""),
        "videoId": payload.get("videoId", ""),
        "provider": provider.name,
        "frameCount": len(frames),
        "poseFrameCount": len(pose_frames),
        "averageConfidence": average([frame["poseConfidence"] for frame in pose_frames]),
        "elapsedMs": round((time.time() - started) * 1000, 2),
        "modelStatus": provider_status(provider.name),
        "frames": pose_frames,
    }


def run_smoke_image(image_path: str, provider_name: Optional[str] = None) -> Dict[str, Any]:
    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise PoseError("SMOKE_IMAGE_NOT_FOUND", f"测试图片不存在：{image_path}", 400)
    payload = {
        "taskId": "smoke_task",
        "videoId": "smoke_video",
        "provider": provider_name or os.getenv("POSE_PROVIDER", "synthetic"),
        "frames": [{
            "frameIndex": 1,
            "timestampMs": 0,
            "imagePath": str(path),
            "width": 960,
            "height": 540,
        }],
    }
    result = handle_detect(payload)
    first_frame = result["frames"][0]
    missing = [name for name in KEYPOINT_NAMES if name not in first_frame["keypoints"]]
    if missing:
        raise PoseError("SMOKE_KEYPOINTS_INCOMPLETE", f"关键点字段缺失：{', '.join(missing)}", 500)
    if result["provider"] != "synthetic" and first_frame["poseConfidence"] <= 0:
        raise PoseError("SMOKE_POSE_NOT_DETECTED", "真实模型未检测到可用人体关键点。", 422)
    return result


class Handler(BaseHTTPRequestHandler):
    server_version = "SoaiPoseService/0.1"

    def do_OPTIONS(self) -> None:
        self.send_json(204, {})

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            self.send_json(200, {
                "ok": True,
                "success": True,
                "service": "soai-pose-service",
                "provider": normalize_provider_name(os.getenv("POSE_PROVIDER", "synthetic")),
                "providerStatus": provider_status(),
                "time": now_iso(),
            })
            return
        if path == "/v1/pose/providers":
            self.send_json(200, {
                "success": True,
                "providers": [
                    provider_status("synthetic"),
                    provider_status("yolo-pose"),
                    provider_status("rtmpose"),
                ],
            })
            return
        self.send_json(404, {"code": "NOT_FOUND", "message": "接口不存在。"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/v1/pose/detect":
            self.send_json(404, {"code": "NOT_FOUND", "message": "接口不存在。"})
            return
        try:
            payload = self.read_json()
            self.send_json(200, handle_detect(payload))
        except PoseError as exc:
            self.send_json(exc.status, {"success": False, "code": exc.code, "message": exc.message})
        except Exception as exc:
            traceback.print_exc()
            self.send_json(500, {"success": False, "code": "INTERNAL_ERROR", "message": str(exc)})

    def read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("content-length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            return json.loads(raw or "{}")
        except json.JSONDecodeError as exc:
            raise PoseError("JSON_INVALID", "请求 JSON 格式不正确。", 400) from exc

    def send_json(self, status: int, payload: Dict[str, Any]) -> None:
        body = b"" if status == 204 else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("[%s] %s\n" % (now_iso(), fmt % args))


def main() -> None:
    parser = argparse.ArgumentParser(description="SOAI Python Pose Service")
    parser.add_argument("--host", default=os.getenv("POSE_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("POSE_PORT", "8793")))
    parser.add_argument("--check", action="store_true", help="检查当前 provider 配置并退出。")
    parser.add_argument("--load-check", action="store_true", help="检查并尝试加载当前 provider。")
    parser.add_argument("--smoke-image", help="使用当前 provider 对单张图片做端到端推理验收。")
    args = parser.parse_args()
    if args.check or args.load_check:
        status = provider_status(load=args.load_check)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        raise SystemExit(0 if status["ready"] else 1)
    if args.smoke_image:
        try:
            result = run_smoke_image(args.smoke_image)
        except PoseError as exc:
            print(json.dumps({"success": False, "code": exc.code, "message": exc.message}, ensure_ascii=False, indent=2))
            raise SystemExit(1)
        print(json.dumps({
            "success": True,
            "provider": result["provider"],
            "poseFrameCount": result["poseFrameCount"],
            "averageConfidence": result["averageConfidence"],
            "modelStatus": result["modelStatus"],
            "sampleKeypoints": result["frames"][0]["keypoints"],
        }, ensure_ascii=False, indent=2))
        raise SystemExit(0)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"SOAI pose service listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
