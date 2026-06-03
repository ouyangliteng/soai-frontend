# SOAI 后台管理 MVP

## 1. 当前能力

第一版后台用于 soai 小程序内测期管理：

- 查看数据总览、视频数量、报告数量、待复核报告、反馈数量
- 查看小程序上传视频记录
- 新增课程，并绑定视频 ID
- 查看学员和报告数量
- 新增运营内容队列
- 新增产品资料
- 检查阿里云 OSS 配置是否齐全

## 2. 本地运行

先启动后端：

```bash
cd ../后端Mock服务
npm start
```

再启动后台：

```bash
cd ../后台管理MVP
python3 -m http.server 8792
```

访问：

```text
http://localhost:8792
```

本地默认连接：

```text
API 地址：http://127.0.0.1:8787
后台 Token：soai-admin-dev
```

## 3. 生产建议域名

建议拆分：

```text
https://api.soai.yun    后端 API
https://admin.soai.yun  后台管理
https://www.soai.yun    官网
```

微信小程序后台需要配置 `https://api.soai.yun` 为 request 合法域名。

## 4. 后端环境变量

生产环境建议至少设置：

```text
NODE_ENV=production
PORT=8787
SOAI_API_PUBLIC_BASE_URL=https://api.soai.yun
SOAI_ADMIN_TOKEN=请替换为强密码Token
SOAI_DB_FILE=/data/soai-storage/db/soai-db.json
SOAI_STORAGE_ROOT=/data/soai-storage
SOAI_STORAGE_PUBLIC_BASE_URL=https://api.soai.yun/storage
```

如果先接阿里云 OSS，继续补：

```text
SOAI_STORAGE_PROVIDER=aliyun-oss
ALIYUN_OSS_BUCKET=你的bucket名称
ALIYUN_OSS_REGION=例如 oss-cn-hangzhou
ALIYUN_OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
ALIYUN_ACCESS_KEY_ID=RAM子账号AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=RAM子账号AccessKeySecret
ALIYUN_RAM_ROLE_ARN=可选，后续做STS临时授权时使用
```

## 5. 阿里云 OSS 权限建议

不要使用阿里云主账号 AccessKey。建议创建 RAM 子账号，最小权限：

- 只允许访问 soai 使用的 bucket
- 允许 `oss:PutObject`
- 允许 `oss:GetObject`
- 允许 `oss:DeleteObject`
- 允许 `oss:ListObjects`

正式视频课程建议后续升级为：

- OSS 存原始素材、封面、产品资料
- 阿里云 VOD 存正式播放视频
- 后端生成短期效播放地址或播放凭证

## 6. 当前边界

当前 MVP 仍是内测级：

- 后台鉴权是 Bearer Token，不是完整账号权限系统
- 数据默认仍可用 JSON 文件持久化，正式上线应升级 MySQL/PostgreSQL
- OSS 已有第一版 POST Policy 签名直传；生产建议继续补 STS 临时授权、回调校验和访问权限控制
- 视频课程管理已经可以登记和绑定视频 ID，真实媒资处理下一步接 OSS/VOD
