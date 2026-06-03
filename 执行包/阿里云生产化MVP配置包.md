# SOAI 阿里云生产化 MVP 配置包

## 1. 目标

把本机已跑通的链路迁移到阿里云服务器内测环境：

```text
微信小程序
-> https://api.soai.yun
-> Node API
-> 本地/OSS 视频上传
-> ffmpeg 抽帧
-> Python YOLO-Pose Service
-> 马术规则引擎
-> 训练报告
-> 后台管理 https://admin.soai.yun
```

## 2. 推荐上线顺序

### 第 1 步：先跑通服务器本地存储

环境变量使用：

```text
SOAI_STORAGE_PROVIDER=local
SOAI_STORAGE_ROOT=/data/soai-storage
SOAI_STORAGE_PUBLIC_BASE_URL=https://api.soai.yun/storage
SOAI_POSE_PROVIDER=http
SOAI_POSE_MODEL_PROVIDER=yolo-pose
SOAI_POSE_SERVICE_URL=http://127.0.0.1:8793
```

原因：

- 先验证服务器 Node、ffmpeg、Docker、YOLO、Nginx、HTTPS 是否稳定。
- 避免 OSS、域名、模型服务问题混在一起。

### 第 2 步：再切 OSS 直传

配置：

```text
SOAI_STORAGE_PROVIDER=aliyun-oss
ALIYUN_OSS_BUCKET=你的 bucket
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_ENDPOINT=https://你的 bucket.oss-cn-hangzhou.aliyuncs.com
ALIYUN_OSS_PUBLIC_BASE_URL=https://你的 bucket.oss-cn-hangzhou.aliyuncs.com
ALIYUN_ACCESS_KEY_ID=RAM 子账号 AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=RAM 子账号 AccessKeySecret
```

当前第一版 OSS 实现方式：

- `POST /api/videos/upload-token` 返回 OSS POST Policy、signature、uploadFormData。
- 小程序 `wx.uploadFile` 自动带 `formData` 上传到 OSS。
- 小程序上传完成后仍调用 `POST /api/videos/{videoId}/upload-status` 通知后端。

## 3. 服务器目录

```bash
mkdir -p /data/soai-storage/uploads /data/soai-storage/frames /data/soai-storage/db
mkdir -p /www/wwwroot
```

代码目录：

```text
/www/wwwroot/soai-frontend
```

## 4. Python YOLO 服务

服务器使用专用 compose：

```bash
cd /www/wwwroot/soai-frontend/PythonPose服务
docker compose -f docker-compose.aliyun.yml up -d --build
curl http://127.0.0.1:8793/health
curl http://127.0.0.1:8793/v1/pose/providers
```

注意：

- YOLO 服务只绑定 `127.0.0.1:8793`，不要暴露公网。
- `/data/soai-storage` 只读挂载给容器，保证容器能读取 Node 抽出的帧。

## 5. Node API

参考：

```text
后端Mock服务/.env.example
后端Mock服务/deploy/ecosystem.config.cjs
```

启动：

```bash
cd /www/wwwroot/soai-frontend/后端Mock服务
npm install
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

验收：

```bash
bash deploy/verify-api.sh https://api.soai.yun "$SOAI_ADMIN_TOKEN"
```

## 6. 小程序 API 模式联调清单

微信公众平台配置：

- request 合法域名：`https://api.soai.yun`
- uploadFile 合法域名：`https://api.soai.yun`
- downloadFile 合法域名：`https://api.soai.yun`

开发者工具 Console：

```js
wx.setStorageSync("soai_data_mode", "api")
wx.setStorageSync("soai_api_base_url", "https://api.soai.yun")
```

联调顺序：

1. 打开首页，确认无接口报错。
2. 进入资料页，保存学员资料。
3. 上传 10-60 秒、150MB 内 mp4/mov。
4. 进入分析页，等待任务完成。
5. 打开报告页，确认 `poseSummary.modelProvider` 后端为 `yolo-pose`。
6. 教练端打开待复核报告，提交复核。
7. 后台打开 `https://admin.soai.yun`，确认视频、报告、反馈、OSS 状态可见。

## 7. 仍需生产化的边界

- JSON 文件持久化只适合小规模内测，正式版应升级 MySQL/PostgreSQL。
- 后台 Bearer Token 只能用于 MVP，后续应升级账号、角色权限和操作审计。
- OSS AccessKey 必须用 RAM 子账号，不能用阿里云主账号。
- 公开投放前需要微信登录、OpenID、教练/学员绑定和视频访问权限控制。
