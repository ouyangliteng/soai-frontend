# SOAI Python Pose Service

## 1. 作用

这是 SOAI 真实姿态识别服务的独立边界：

```text
Node 抽帧
↓
Python Pose Service
↓
YOLO-Pose / RTMPose
↓
SOAI 标准关键点 JSON
↓
Node 马术规则引擎
↓
训练报告
```

当前服务已经提供稳定 HTTP 协议和三个 provider 入口：

- `synthetic`：本地开发兜底，不依赖模型
- `yolo-pose`：预留 `ultralytics` YOLO-Pose 接入
- `rtmpose`：预留 `mmpose` RTMPose 接入

## 2. 本地启动

基础环境：

```bash
cd PythonPose服务
bash scripts/setup-pose-service.sh base
```

```bash
cd PythonPose服务
python3 pose_service.py --host 127.0.0.1 --port 8793
```

健康检查：

```bash
curl http://127.0.0.1:8793/health
```

本地验证：

```bash
bash scripts/verify-pose-service.sh
```

如果要验证真实模型能否加载：

```bash
bash scripts/verify-pose-service.sh --load-check
```

如果要用真实图片做模型端到端验收：

```bash
bash scripts/verify-pose-service.sh --load-check --smoke-image /data/soai-storage/frames/sample-rider.jpg
```

Provider 状态：

```bash
curl http://127.0.0.1:8793/v1/pose/providers
```

启动前检查当前 provider：

```bash
python3 pose_service.py --check
```

如果要同时尝试加载模型：

```bash
python3 pose_service.py --load-check
```

## 3. Node 后端接入

后端环境变量：

```text
SOAI_POSE_PROVIDER=http
SOAI_POSE_SERVICE_URL=http://127.0.0.1:8793
SOAI_POSE_MODEL_PROVIDER=synthetic
SOAI_POSE_SERVICE_TIMEOUT_MS=30000
```

如果希望 Python 服务不可用时自动回退到 Node 本地模拟：

```text
SOAI_POSE_PROVIDER=auto
```

## 4. YOLO-Pose 配置

安装依赖：

```bash
bash scripts/setup-pose-service.sh yolo
```

设置：

```text
POSE_PROVIDER=yolo-pose
YOLO_POSE_MODEL_PATH=/data/soai-models/yolo11n-pose.pt
```

Node 侧：

```text
SOAI_POSE_PROVIDER=http
SOAI_POSE_MODEL_PROVIDER=yolo-pose
```

Docker 方式：

```bash
mkdir -p /data/soai-models
# 将 yolo11n-pose.pt 放到 /data/soai-models/yolo11n-pose.pt
docker compose -f docker-compose.yolo.yml up -d --build
curl http://127.0.0.1:8793/v1/pose/providers
```

## 5. RTMPose 配置

安装依赖：

```bash
bash scripts/setup-pose-service.sh rtmpose
```

RTMPose 还需要根据服务器 CPU/GPU 和 CUDA 版本安装 PyTorch 与 MMCV。模型配置：

```text
POSE_PROVIDER=rtmpose
RTMPOSE_CONFIG_PATH=/data/soai-models/rtmpose/rtmpose-m.py
RTMPOSE_CHECKPOINT_PATH=/data/soai-models/rtmpose/rtmpose-m.pth
RTMPOSE_DEVICE=cpu
```

Node 侧：

```text
SOAI_POSE_PROVIDER=http
SOAI_POSE_MODEL_PROVIDER=rtmpose
```

## 6. 请求协议

```http
POST /v1/pose/detect
Content-Type: application/json
```

```json
{
  "taskId": "task_001",
  "videoId": "video_001",
  "provider": "synthetic",
  "frames": [
    {
      "frameIndex": 1,
      "timestampMs": 0,
      "imagePath": "/data/soai-storage/frames/task_001_frame_0001.jpg",
      "width": 960,
      "height": 540
    }
  ]
}
```

## 7. 响应协议

```json
{
  "success": true,
  "provider": "synthetic",
  "frameCount": 1,
  "poseFrameCount": 1,
  "averageConfidence": 0.79,
  "frames": [
    {
      "frameIndex": 1,
      "timestampMs": 0,
      "keypoints": {
        "leftShoulder": { "x": 501.2, "y": 169.2, "confidence": 0.86 }
      },
      "poseConfidence": 0.79,
      "visibilityQuality": "usable",
      "provider": "synthetic",
      "modelName": "soai-synthetic-v1"
    }
  ]
}
```

Node 规则引擎依赖的关键点名称：

```text
nose, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist,
rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle
```

## 8. 生产注意

- Python 服务建议只监听内网地址，不直接暴露公网。
- YOLO/RTMPose 模型文件放在 `/data/soai-models`，不要提交到代码仓库。
- 第一阶段先用 CPU 验证链路；正式视频量上来后再上 GPU 实例。
- Node 只消费标准关键点 JSON，不绑定具体模型，方便后续替换模型。
- 服务会缓存已加载的模型，避免每次视频分析重复初始化 YOLO/RTMPose。
- 部署切换真实模型前，先执行 `python3 pose_service.py --load-check`。

## 9. 生产切换顺序

1. 启动 Python Pose Service，并确认 `curl http://127.0.0.1:8793/health` 正常。
2. 确认 `curl http://127.0.0.1:8793/v1/pose/providers` 里 `yolo-pose` 或 `rtmpose` 为 `ready: true`。
3. 用真实骑乘截图执行 `bash scripts/verify-pose-service.sh --load-check --smoke-image /path/to/rider.jpg`。
4. 修改 Node 后端环境变量：

```text
SOAI_POSE_PROVIDER=http
SOAI_POSE_SERVICE_URL=http://127.0.0.1:8793
SOAI_POSE_MODEL_PROVIDER=yolo-pose
```

也可以直接生成变量：

```bash
bash scripts/generate-node-pose-env.sh yolo-pose
```

5. 重启 Node 后端，上传一段 10-60 秒训练视频，确认报告 `poseSummary.modelProvider` 为 `yolo-pose`。

## 10. 官方参考

- Ultralytics Pose 文档：https://docs.ultralytics.com/tasks/pose/
- Ultralytics Predict/Keypoints 文档：https://docs.ultralytics.com/modes/predict/
- MMPose 推理接口文档：https://mmpose.readthedocs.io/en/latest/_modules/mmpose/apis/inference.html
