# 小程序 API 对接指南

## 1. 当前状态

小程序原型当前默认使用本地 `utils/store.js` mock 数据。

现在已经补充：

- `../后端Mock服务`：本地可运行 Mock API。
- `../小程序原型V0.2/utils/api.js`：小程序 HTTP 请求封装。
- `../小程序原型V0.2/utils/data-service.js`：本地 mock 和 HTTP API 的统一数据源适配层。

当前核心页面已经改为调用 `data-service.js`。默认是本地演示模式，切到 API 模式后会通过 `api.js` 请求 Mock API。

## 2. 本地联调步骤

### 2.1 启动 Mock API

```bash
cd 后端Mock服务
npm start
```

默认地址：

```text
http://127.0.0.1:8787
```

### 2.2 微信开发者工具设置

开发调试阶段需要：

- 关闭合法域名校验。
- 或者把本机地址代理到 HTTPS 测试域名。

### 2.3 小程序切换数据源

进入小程序：

```text
资料页 -> 数据源 -> API
```

切到 API 后，以下页面会请求 Mock API：

- 首页
- 学员资料
- 上传视频
- AI 分析中
- 报告页
- 历史趋势
- 教练工作台
- 学员详情

也可以在调试器中手动设置：

```js
wx.setStorageSync("soai_data_mode", "api")
```

切回本地演示：

```js
wx.setStorageSync("soai_data_mode", "local")
```

正式环境必须：

- 使用 HTTPS。
- 配置小程序 request 合法域名。
- 接入真实登录和权限。

## 3. 方法映射

| 当前本地方法 | API 方法 | 接口 |
| --- | --- | --- |
| `store.getProfile` | `api.getProfile` | `GET /api/student/profile` |
| `store.saveProfile` | `api.saveProfile` | `POST /api/student/profile` |
| `store.getReport` | `api.getReport` | `GET /api/reports/{reportId}` |
| `store.getTrend` | `api.getTrend` | `GET /api/students/{studentId}/trends` |
| `store.getCoachDashboard` | `api.getCoachDashboard` | `GET /api/coach/dashboard` |
| `store.getCoachStudentDetail` | `api.getCoachStudent` | `GET /api/coach/students/{studentId}` |
| `store.saveCoachReview` | `api.submitCoachReview` | `POST /api/coach/reports/{reportId}/review` |
| 无 | `api.trackEvent` | `POST /api/analytics/events` |
| 无 | `api.submitFeedback` | `POST /api/feedback` |

## 4. 建议替换顺序

核心页面已经完成第一轮替换，现在页面调用关系是：

```text
pages/* -> utils/data-service.js -> 本地 store.js 或 HTTP api.js
```

后续如果要接真实后端，优先替换 `api.js` 的 `DEFAULT_BASE_URL` 和接口字段适配，不需要再逐页重写业务逻辑。

### 第 1 步：资料页

文件：

- `pages/profile/profile.js`

已完成替换：

- `store.getProfile` -> `api.getProfile`
- `store.saveProfile` -> `api.saveProfile`

原因：

- 风险最低。
- 能先验证 request、错误提示、基础数据保存。

### 第 2 步：报告和趋势

文件：

- `pages/report/report.js`
- `pages/trends/trends.js`

已完成第一轮替换：

- 报告详情接口。
- 历史趋势接口。
- 教练复核接口。

### 第 3 步：上传和分析

文件：

- `pages/upload/upload.js`
- `pages/analysis/analysis.js`

已完成第一轮替换：

- 创建上传凭证。
- 上传状态更新。
- 创建分析任务。
- 轮询分析任务。

### 第 4 步：教练端

文件：

- `pages/coach/coach.js`
- `pages/coach-student/coach-student.js`

已完成第一轮替换：

- 教练工作台。
- 学员详情。
- 待复核报告。

### 第 5 步：埋点和反馈

文件：

- `utils/api.js`
- `utils/data-service.js`
- `pages/profile/profile.js`
- `pages/upload/upload.js`
- `pages/analysis/analysis.js`
- `pages/report/report.js`
- `pages/trends/trends.js`

已完成第一轮接入：

- 资料页浏览和保存成功。
- 视频选择、校验失败、开始上传、上传成功、上传失败。
- 分析任务创建、分析成功、分析失败、重试点击。
- 报告查看、趋势查看、教练复核提交。

说明：

- 本地模式下埋点为静默成功，不影响原型演示。
- API 模式下埋点发送到 `POST /api/analytics/events`。
- 埋点失败不阻断用户主流程。

## 5. 错误处理规则

必须处理：

- `VIDEO_TOO_LARGE`
- `VIDEO_TOO_SHORT`
- `VIDEO_TOO_LONG`
- `VIDEO_FORMAT_UNSUPPORTED`
- `VIDEO_CONSENT_REQUIRED`
- `UPLOAD_NETWORK_ERROR`
- `ANALYSIS_TIMEOUT`
- `ANALYSIS_FAILED`
- `PROFILE_REQUIRED`

页面表现：

- 错误文案要直接告诉用户下一步。
- 可恢复错误必须提供重试。
- 资料、视频选择和分析任务 ID 不应因为错误丢失。
- 未确认视频用于训练分析时，不允许请求上传凭证。
- 匿名案例授权必须独立记录，不可作为默认勾选项。

## 6. 上线前必须替换的能力

Mock API 只用于联调，上线前必须接入：

- 微信登录。
- 用户和教练权限。
- 真实对象存储上传。
- 真实 AI 视频分析任务。
- HTTPS API 域名。
- 数据库存储。
- 视频访问权限控制。
