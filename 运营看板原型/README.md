# SOAI 运营看板原型

## 1. 定位

这是 SOAI 马术 AI 训练系统的内部运营看板原型，用于内测和种子用户期每日观察。

覆盖指标：

- 新增报名
- 视频上传成功率
- AI 分析成功率
- 报告打开率
- 教练复核率
- 二次上传人数
- 内测日报结论
- 每日 6 问和明日动作
- 学员/教练反馈评分
- 高频反馈标签
- 内容到产品咨询转化漏斗
- 渠道表现
- 内容发布队列
- 风险预警

## 2. 运行方式

先启动 Mock API：

```bash
cd 后端Mock服务
npm start
```

再启动看板：

```bash
cd 运营看板原型
python3 -m http.server 8791
```

访问：

```text
http://localhost:8791
```

如果 Mock API 未启动，看板会自动使用本地兜底数据。

## 3. 数据接口

```text
GET http://localhost:8787/api/operations/dashboard
GET http://localhost:8787/api/operations/daily-report
```

后续接真实数据时，优先替换后端接口，不需要重写前端页面结构。

## 4. 内测日报

看板会读取 Mock API 的 `daily-report` 接口，展示：

- 今日结论
- Go / Conditional Go 状态
- 核心指标
- 每日 6 问
- 明日动作

页面提供“复制日报”按钮，方便运营直接粘贴到内部复盘或微信群。

如果当前浏览器不允许直接写入剪贴板，页面会显示可手动复制的日报文本框。

## 5. 反馈闭环

看板会读取 Mock API 的 `feedbackSummary` 字段，展示：

- 反馈数量
- 总体评分
- 教练准确性评分
- 训练价值评分
- 高频标签
- 最近反馈

这些数据来自小程序内测反馈页提交到 `POST /api/feedback` 的内容。

## 6. 视觉参考

```text
../执行包/assets/运营看板视觉参考.png
```

关键词：

- 内部运营工具
- 数据密集但清晰
- 深海军蓝侧栏
- 白色内容区
- 电光蓝指标强调
- 风险边界明确
