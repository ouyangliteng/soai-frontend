# SOAI Lite 部署交接说明

更新时间：2026-07-06

## 当前可运行版本

- 小程序前端仓库：`SOAI-Lite`
- 后端 / 姿态服务仓库：`soai-frontend` 内的 `后端Mock服务` 与 `PythonPose服务`
- 小程序前端 commit：`22d38e9cf137605c497a53e83efae2de4f81de43`
- 后端 / 姿态服务 commit：`81ed605c7b1da1851c661fb5a630b161768615af`
- 当前可运行标签：`soai-lite-runnable-20260706-latest`
- 线上 API 域名：`https://api.soai.yun`
- API 进程：`soai-lite-api`
- 姿态服务容器：`soai-pose-service`
- 本次服务器备份：`/root/soai-lite-backups/soai-lite-runtime-20260706-143029`

## 服务器路径

- API 代码目录：`/www/wwwroot/soai-lite-api`
- 数据与上传文件目录：`/data/soai-storage`
- 数据库文件：`/data/soai-storage/db/soai-db.json`
- 上传视频与姿态叠加视频：`/data/soai-storage/uploads`
- 抽帧目录：`/data/soai-storage/frames`
- 姿态服务配置目录：`/www/wwwroot/soai-lite-api/PythonPose服务`

## 启动方式

### API

API 使用 PM2 运行：

```bash
cd /www/wwwroot/soai-lite-api
pm2 reload soai-lite-api --update-env
pm2 save
pm2 logs soai-lite-api --lines 120
```

当前主要端口：

- API 本地端口：`8787`
- 对外域名：`https://api.soai.yun`
- 存储公开前缀：`https://api.soai.yun/storage`

### PythonPose / YOLO 姿态服务

姿态服务通过 Docker 运行：

```bash
cd /www/wwwroot/soai-lite-api/PythonPose服务
docker compose -f docker-compose.aliyun.yml up -d
docker ps | grep soai-pose-service
docker logs --tail 120 soai-pose-service
```

当前服务端口：

- 容器名：`soai-pose-service`
- 容器监听：`8793`
- 主机映射：`127.0.0.1:8793->8793/tcp`
- 健康检查：`http://127.0.0.1:8793/health`

## 关键环境变量

以下只记录变量名和非敏感值，不记录明文密钥。

- `NODE_ENV=production`
- `PORT=8787`
- `SOAI_API_PUBLIC_BASE_URL=https://api.soai.yun`
- `SOAI_STORAGE_PROVIDER=local`
- `SOAI_STORAGE_ROOT=/data/soai-storage`
- `SOAI_DB_FILE=/data/soai-storage/db/soai-db.json`
- `SOAI_STORAGE_PUBLIC_BASE_URL=https://api.soai.yun/storage`
- `SOAI_MAX_UPLOAD_MB=150`
- `SOAI_MAX_VIDEO_DURATION_SEC=15`
- `SOAI_FRAME_FPS=5`
- `SOAI_REQUIRE_REAL_POSE=true`
- `SOAI_POSE_ALLOW_SYNTHETIC_FALLBACK=false`
- `SOAI_POSE_PROVIDER=http`
- `SOAI_POSE_MODEL_PROVIDER=yolo-pose`
- `SOAI_POSE_SERVICE_URL=http://127.0.0.1:8793`
- `SOAI_POSE_SERVICE_TIMEOUT_MS=180000`
- `SOAI_LITE_INVITE_MAX_USERS=20`
- `SOAI_LITE_INVITE_CODES=<20 个正式内测邀请码>`
- `SOAI_LITE_INTERNAL_INVITE_CODE=<内部工程/小程序审核专用码>`
- `WECHAT_MINI_APP_ID=wx85e25dc803ceab29`
- `WECHAT_MINI_APP_SECRET=<redacted>`
- `SOAI_ADMIN_TOKEN=<redacted>`
- `ALIYUN_ACCESS_KEY_ID=<redacted>`
- `ALIYUN_ACCESS_KEY_SECRET=<redacted>`

## 微信登录配置

小程序 AppID：`wx85e25dc803ceab29`

后端登录入口：

```text
POST /api/lite/v1/auth/wx-login
```

登录成功后，后端返回 `token` 与 `profile`。前端将 `token` 放入后续接口的 `Authorization: Bearer <token>` 请求头。

手机端真实测试注意：

- 不再使用本地邀请码缓存判断资格。
- 手机微信账号必须在服务器侧完成邀请码验证。
- 普通邀请码一人一码，只能绑定一个微信用户。
- 内部工程/审核专用码不在前端展示，不占普通 20 个邀请码名额。

## 上传、姿态识别、报告生成链路

1. 前端登录：`POST /api/lite/v1/auth/wx-login`
2. 验证邀请码：`POST /api/lite/v1/invite/verify`
3. 查询上传权限：`GET /api/lite/v1/upload/quota`
4. 获取上传地址：`POST /api/lite/v1/videos/upload-token`
5. 本地存储上传：`POST /api/lite/v1/mock-upload/:videoId`
6. 通知上传完成：`POST /api/lite/v1/videos/:videoId/upload-status`
7. 创建分析任务：`POST /api/lite/v1/analysis/tasks`
8. 后端抽帧：`ffmpeg` 按 `SOAI_FRAME_FPS=5` 抽帧
9. 姿态识别：API 调用 `SOAI_POSE_SERVICE_URL=http://127.0.0.1:8793`
10. 生成姿态轨迹、规则评分、报告文本
11. 生成彩色姿态叠加视频：`src/pose-overlay-video.js`
12. 前端报告页播放 `poseOverlayVideoUrl`
13. 前端报告页通过 `GET /api/lite/v1/reports/:id/pdf` 导出完整 PDF
14. PDF 为单页长报告，前端提供“预览完整 PDF”和“转发 PDF 给好友”

## 关键行为规则

- `SOAI2026` 类内部/审核专用码不在前端展示。
- 正式 20 个邀请码每个只能绑定一个微信用户。
- 内部/审核专用码不占普通 20 个邀请码名额。
- 内部/审核专用码账号上传检测不限次数。
- 普通邀请码账号仍按每日分析次数限制。
- 同一用户上传同一视频时不重复分析，复用原报告并提示用户查看原报告。
- 报告页优先播放后端生成的彩色姿态叠加视频。
- 若旧报告没有叠加视频，前端兜底显示分色关节点。
- 报告导出只保留 PDF，不再保留相册长图入口。
- 微信 `openDocument` 预览页不保证显示保存/转发按钮；前端通过 `shareFileMessage` 提供 PDF 转发入口。

## 常见故障排查

### 8793 不通

```bash
curl -s http://127.0.0.1:8793/health
docker ps | grep soai-pose-service
docker logs --tail 120 soai-pose-service
```

处理：

```bash
cd /www/wwwroot/soai-lite-api/PythonPose服务
docker compose -f docker-compose.aliyun.yml up -d
```

### 姿态服务没启动

确认容器状态和端口映射：

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

预期看到：

```text
soai-pose-service   Up ... (healthy)   127.0.0.1:8793->8793/tcp
```

### 上传后失败

检查：

```bash
pm2 logs soai-lite-api --lines 120
du -sh /data/soai-storage
ls -lah /data/soai-storage/uploads | tail
```

重点确认：

- 上传视频是否落到 `/data/soai-storage/uploads`
- `ffmpeg` 是否能抽帧
- `SOAI_REQUIRE_REAL_POSE=true` 时，不允许回退到合成姿态
- `SOAI_POSE_SERVICE_URL` 是否能访问

### 视频有了但没有彩色姿态点

检查报告数据中是否有：

- `poseTrack.frames`
- `poseOverlayVideoUrl`
- `poseOverlayStorageKey`

检查文件：

```bash
ls -lah /data/soai-storage/uploads/*pose_overlay*.mp4 | tail
```

### 微信无法登录

检查：

- `WECHAT_MINI_APP_ID`
- `WECHAT_MINI_APP_SECRET`
- 小程序后台服务器域名是否包含 `https://api.soai.yun`
- 后端日志中的 `authMode`

### 邀请码异常

普通邀请码重复使用会返回：

```text
INVITE_CODE_USED
```

说明该码已绑定其他微信用户，需要发放新的邀请码。

## 恢复步骤

1. 解压 API：

```bash
tar -C /www/wwwroot -xzf /root/soai-lite-backups/soai-lite-runtime-20260706-143029/soai-lite-api.tar.gz
```

2. 解压数据：

```bash
tar -C /data -xzf /root/soai-lite-backups/soai-lite-runtime-20260706-143029/soai-storage.tar.gz
```

3. 启动姿态服务：

```bash
cd /www/wwwroot/soai-lite-api/PythonPose服务
docker compose -f docker-compose.aliyun.yml up -d
```

4. 启动 API：

```bash
cd /www/wwwroot/soai-lite-api
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

5. 验证：

```bash
curl -s https://api.soai.yun/api/lite/v1/health
curl -s http://127.0.0.1:8793/health
```
