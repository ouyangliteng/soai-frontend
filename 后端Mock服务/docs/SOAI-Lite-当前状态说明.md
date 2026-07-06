# SOAI Lite 当前状态说明

这份文件用于新开对话时快速恢复上下文。

## 项目路径

- 本地工作区：`/Users/ouyangliteng/Claude/Projects/soai-EQ`
- 小程序前端：`/Users/ouyangliteng/Claude/Projects/soai-EQ/soai-lite`
- 后端：`/Users/ouyangliteng/Claude/Projects/soai-EQ/欧阳codex（学员）/后端Mock服务`
- 姿态服务：`/Users/ouyangliteng/Claude/Projects/soai-EQ/欧阳codex（学员）/PythonPose服务`

## 服务器状态

- API 域名：`https://api.soai.yun`
- API 目录：`/www/wwwroot/soai-lite-api`
- API 进程：`soai-lite-api`
- API 端口：`8787`
- 存储目录：`/data/soai-storage`
- DB 文件：`/data/soai-storage/db/soai-db.json`
- 姿态服务容器：`soai-pose-service`
- 姿态服务端口：`127.0.0.1:8793`
- 服务器备份：`/root/soai-lite-backups/soai-lite-runtime-20260706-143029`

## 当前 Git 版本

- 小程序前端 `SOAI-Lite`：`22d38e9cf137605c497a53e83efae2de4f81de43`
- 后端 / 姿态服务 `soai-frontend`：`81ed605c7b1da1851c661fb5a630b161768615af`
- 当前可运行标签：`soai-lite-runnable-20260706-latest`

## 当前已打通功能

- 微信小程序真实登录
- 手机端邀请码验证
- 普通 20 个邀请码一人一码
- 内部/审核专用码不在前端展示
- 内部/审核专用码不占普通邀请码名额
- SOAI Lite 上传视频真实分析
- YOLO 姿态识别服务
- 5fps 抽帧
- 彩色姿态点动态跟随骑手
- 单侧腿部姿态点
- 同一用户同一视频复用旧报告，不重复分析
- 报告页播放带彩色姿态点的视频
- 报告导出只保留完整 PDF
- 报告 PDF 为单页长报告，可在小程序内预览或转发给好友 / 文件传输助手

## 重要规则

- 不要在前端展示内部/审核专用邀请码。
- 普通邀请码只能绑定一个微信用户。
- 后端密钥只记录变量名，不记录明文值。
- 真实姿态识别不允许回退到合成轨迹：`SOAI_REQUIRE_REAL_POSE=true`。
- 姿态服务地址为 `http://127.0.0.1:8793`。
- 报告视频优先使用 `poseOverlayVideoUrl`。
- 报告导出不再生成相册长图，统一使用 `/api/lite/v1/reports/:id/pdf`。

## 常用命令

```bash
cd /www/wwwroot/soai-lite-api
pm2 logs soai-lite-api --lines 120
pm2 reload soai-lite-api --update-env
```

```bash
cd /www/wwwroot/soai-lite-api/PythonPose服务
docker compose -f docker-compose.aliyun.yml up -d
docker logs --tail 120 soai-pose-service
```

```bash
curl -s http://127.0.0.1:8793/health
curl -s https://api.soai.yun/api/lite/v1/health
```

## 本地验证

前端：

```bash
cd /Users/ouyangliteng/Claude/Projects/soai-EQ/soai-lite
npm run build:weapp
npm test -- --runInBand tests/services/reports.test.ts
```

后端：

```bash
cd /Users/ouyangliteng/Claude/Projects/soai-EQ/欧阳codex（学员）/后端Mock服务
node test/lite-api.test.js
node test/invite-code.test.js
node test/wechat-login.test.js
node test/yolo-provider-report.test.js
```
