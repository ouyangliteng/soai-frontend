# SOAI 马术 AI 教学小程序 Mock API

## 1. 作用

这个服务把执行包里的接口草案变成可运行的 API，方便小程序、AI 分析服务和教练端并行联调。

覆盖链路：

学员资料 -> 视频上传凭证 -> 上传状态 -> AI 分析任务 -> 报告详情 -> 历史趋势 -> 教练工作台 -> 教练复核 -> 训练重点

教练端新增：

学员报告 -> 教练补充学员认知 -> 生成阶段性教学任务大纲

同时包含第一版 AI 智能体接口：

- AI 报告草稿
- AI 报告质量校验
- 教练复核草稿
- 学员报告解读
- 阶段性教学任务大纲
- 运营内容草稿
- 运营数据看板
- 主链路埋点和学员/教练反馈
- 运营看板反馈质量汇总
- 内测日报汇总
- 报告相关产品知识建议
- 后台管理 MVP 接口

## 2. 启动

```bash
cd 后端Mock服务
npm start
```

默认地址：

```text
http://localhost:8787
```

健康检查：

```bash
curl http://localhost:8787/health
```

生产部署到 `api.soai.yun` 参考：

```text
deploy/腾讯云部署清单.md
deploy/ecosystem.config.cjs
deploy/nginx-api.soai.yun.conf
```

小程序生产 API 默认地址为：

```text
https://api.soai.yun
```

服务器运行要求：

```text
Node.js >= 16
```

## 3. 测试

```bash
cd 后端Mock服务
npm test
```

测试会完整跑通：

- 获取学员资料
- 保存学员资料
- 创建视频上传凭证
- 更新上传状态
- 创建 AI 分析任务
- 查询分析任务并生成报告
- 获取报告
- 获取历史趋势
- 获取教练工作台
- 提交教练复核和训练重点
- 获取学员详情
- 验证视频格式错误码
- 生成 AI 报告草稿并校验
- 生成教练复核草稿、学员解读和运营内容
- 生成阶段性教学任务大纲
- 获取运营数据看板
- 获取内测日报
- 上报埋点、查询埋点、提交反馈和获取反馈汇总

## 4. 已实现接口

### 学员端

- `GET /api/student/profile`
- `POST /api/student/profile`
- `POST /api/videos/upload-token`
- `POST /api/videos/{videoId}/upload-status`
- `POST /api/analysis/tasks`
- `GET /api/analysis/tasks/{taskId}`
- `POST /api/analysis/tasks/{taskId}/retry`
- `GET /api/reports/{reportId}`
- `GET /api/reports/{reportId}/product-suggestions`
- `GET /api/students/{studentId}/trends?limit=5`
- `POST /api/reports/{reportId}/coach-review`

说明：

- `POST /api/videos/upload-token` 必须传入 `analysisConsent: true`。
- `caseConsent` 仅表示匿名案例候选授权，公开发布前仍需二次确认。

### 教练端

- `GET /api/coach/dashboard`
- `GET /api/coach/reports?status=pending`
- `GET /api/coach/students`
- `GET /api/coach/students/{studentId}`
- `POST /api/coach/reports/{reportId}/review`
- `POST /api/coach/reports/{reportId}/teaching-outline`

### AI 智能体

- `POST /api/ai/report-draft`
- `POST /api/ai/report-validate`
- `GET /api/ai/reports/{reportId}/coach-review-draft`
- `GET /api/ai/reports/{reportId}/student-explanation`
- `GET /api/ai/reports/{reportId}/operation-content`

### 运营

- `GET /api/operations/dashboard`
- `GET /api/operations/daily-report`
- `POST /api/analytics/events`
- `GET /api/analytics/events`
- `POST /api/feedback`
- `GET /api/feedback/summary`

### 后台管理

后台接口需要请求头：

```text
Authorization: Bearer ${SOAI_ADMIN_TOKEN}
```

本地开发默认 token：

```text
soai-admin-dev
```

接口：

- `GET /api/admin/overview`
- `GET /api/admin/videos`
- `GET /api/admin/users`
- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `POST /api/admin/courses/{courseId}`
- `GET /api/admin/content`
- `POST /api/admin/content`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/oss/status`
- `POST /api/admin/settings`

## 5. 小程序对接方式

小程序当前使用 `utils/store.js` 本地 mock。

后续接入 API 时建议新增：

```text
utils/api.js
```

并逐步把本地方法替换为 HTTP 请求：

- `getProfile` -> `GET /api/student/profile`
- `saveProfile` -> `POST /api/student/profile`
- `saveActiveTask` -> `POST /api/analysis/tasks`
- `getReport` -> `GET /api/reports/{reportId}`
- `getTrend` -> `GET /api/students/{studentId}/trends?limit=5`
- `getCoachDashboard` -> `GET /api/coach/dashboard`
- `saveCoachReview` -> `POST /api/coach/reports/{reportId}/review`
- `generateTeachingOutline` -> `POST /api/coach/reports/{reportId}/teaching-outline`
- `trackEvent` -> `POST /api/analytics/events`
- `submitFeedback` -> `POST /api/feedback`

## 6. 当前限制

- 本地测试默认使用内存数据；生产环境 `NODE_ENV=production` 时会写入 `SOAI_DB_FILE` JSON 文件，适合第一轮马场内测留存资料、报告、批复和反馈。
- JSON 文件持久化仍是内测级方案，正式多教练、多学员上线前应升级为 MySQL/PostgreSQL/MongoDB 等数据库。
- 本地上传地址 `/mock-upload/{videoId}` 可接收真实视频文件，生产环境应替换为 COS/OSS 等对象存储直传地址。
- 分析任务已经拆成抽帧、姿态识别、马术规则、报告生成阶段；未安装 ffmpeg 时会回退为带时间戳的帧元数据。
- 姿态识别支持 `SOAI_POSE_PROVIDER=synthetic` 本地模拟、`http` 调用独立 Python Pose Service、`auto` 失败回退。真实 YOLO-Pose/RTMPose 模型配置见 `../PythonPose服务/README.md`。
- AI 报告基于结构化姿态和规则结果生成，当前不调用外部大模型；可在报告生成层接入 OpenAI 或国内可商用大模型做文本组织。
- 没有登录、鉴权和多教练权限。
- 后台 MVP 目前使用 Bearer Token 鉴权，生产环境必须设置 `SOAI_ADMIN_TOKEN`，后续再升级为管理员账号、角色权限和操作审计。
