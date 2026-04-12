# 微信公众号 Agent 实现 - 任务拆分

> 基于《消息推送Agent整体方案设计》，聚焦"微信公众号"数据源的 Agent 完整闭环实现。
> 拆分为 6 个会话任务，每个会话独立可交付、可验证。

---

## 当前项目状态

- **后端（NestJS）**：骨架已搭建完成，14 个模块全部为 TODO 占位，仅 UserModule 有 TypeORM 实体
- **前端（React + Vite）**：骨架已搭建完成，29 个组件/页面全部为 TODO 占位，未安装路由/状态管理/UI 库
- **ai_news_llm**：微信公众号采集已有完整实现（可参考），核心机制：
  - 通过 `mp.weixin.qq.com` 后台 API（`/cgi-bin/appmsgpublish`）获取文章列表
  - 依赖手动获取的 `WECHAT_TOKEN` + `WECHAT_COOKIE`（7天过期）
  - 通过 cheerio 解析文章正文 HTML 获取纯文本
  - 支持 Token 缓存、过期自动重载、反爬延迟、重试

---

## 任务总览

| # | 会话任务 | 核心交付 | 预计复杂度 |
|---|---------|---------|-----------|
| 1 | 后端数据基础层 | TypeORM 实体 + 数据库迁移 + 用户/来源/内容 CRUD API | 中 |
| 2 | 微信公众号采集器 | WechatCollector 完整实现 + Token 管理 + 采集 API | 高 |
| 3 | Agent 核心引擎 | 自建 Agent Loop + Tool Registry + 基础 Tools + Agent API | 高 |
| 4 | 内容处理 Pipeline | 过滤去重 + 评分系统 + LLM 摘要生成 + 推送（邮件） | 高 |
| 5 | 前端基础框架与核心页面 | 路由 + 状态管理 + Layout + 今日精选 + 数据源管理页面 | 中 |
| 6 | 前端交互与 Agent 闭环 | 内容反馈 + 用户画像页 + Agent 日志查看 + 完整联调 | 中 |

---

## 会话 1：后端数据基础层

### 目标
将所有骨架实体升级为完整的 TypeORM 实体，建立数据库表结构，实现用户、数据源、内容的基础 CRUD API。

### 具体任务

1. **TypeORM 实体完善**（将 `common/database/entities/` 下的 9 个纯 TS 类全部加上 TypeORM 装饰器）
   - `User` 实体：对齐方案中的用户表（profile JSON、preferences JSON、notification_settings JSON）
   - `Source` 实体：数据源表（type、identifier、name、config JSON、status、quality_score、stats JSON）
   - `Content` 实体：内容表（source_id 关联、title、content、url、title_hash、metadata JSON、唯一键约束）
   - `ContentScore` 实体：评分表（score_breakdown JSON、is_selected）
   - `Feedback` 实体：反馈表
   - `Memory` 实体：记忆表
   - `Digest` 实体：日报/周报表
   - `AgentLog` 实体：Agent 决策日志表
   - `UserContentInteraction` 实体：用户-内容交互表

2. **各模块注册实体**（在各自 Module 中通过 `TypeOrmModule.forFeature()` 注册）

3. **基础 CRUD API 实现**
   - `UserController/Service`：注册、获取/更新画像、更新偏好设置
   - `SourceController/Service`：来源 CRUD + 验证接口 + 统计接口
   - `ContentController/Service`：内容列表（分页/筛选）、内容详情、今日精选

4. **统一响应格式**：封装统一的 API 响应 DTO

### 验证标准
- 所有表能通过 TypeORM synchronize 自动创建
- API 可通过 curl/Postman 测试 CRUD 操作
- 数据源类型支持 `wechat`

---

## 会话 2：微信公众号采集器

### 目标
实现完整的微信公众号文章采集能力，参考 `ai_news_llm` 项目的采集逻辑，适配到 NestJS 架构中。

### 具体任务

1. **安装必要依赖**：`axios`、`cheerio`、`uuid`

2. **Token 管理服务**（新建 `src/modules/collector/services/wechat-token.service.ts`）
   - 从 `.env` 读取 `WECHAT_TOKEN` 和 `WECHAT_COOKIE`
   - 本地文件缓存机制（7天过期）
   - Token 过期检测（接口返回 `ret=200003`）
   - 自动重载

3. **WechatCollector 完整实现**（`src/modules/collector/collectors/wechat.collector.ts`）
   - 继承 BaseCollector 抽象类
   - 调用 `https://mp.weixin.qq.com/cgi-bin/appmsgpublish` 获取文章列表
   - 解析多层嵌套 JSON 响应（publish_page → publish_list → appmsgex）
   - 通过 cheerio 抓取文章正文（`#js_content` 容器）
   - 转换为统一 `RawContent` 格式并入库
   - 反爬策略：随机延迟（3-5s/账号，200-400ms/文章）
   - 指数退避重试（最多 3 次）

4. **CollectorService 整合**
   - 按用户的 Source 配置调用对应采集器
   - 采集结果写入 Content 表（URL 去重）

5. **采集 API**
   - `POST /api/sources/validate`：验证公众号 fakeid 是否有效
   - `POST /api/system/sync`：手动触发采集（调试用）
   - 采集状态查询

6. **公众号搜索辅助接口**（可选）
   - 通过 `/cgi-bin/searchbiz` 接口搜索公众号名称，返回 fakeid
   - 前端添加来源时可通过名称搜索

### 环境变量（.env）
```
WECHAT_TOKEN=           # 微信后台 token（手动填充）
WECHAT_COOKIE=          # 微信后台 cookie（手动填充）
```

### 验证标准
- 配置公众号 fakeid 后能采集到文章列表
- 文章正文能完整提取
- 重复 URL 不会重复入库
- Token 过期能正确检测并提示

---

## 会话 3：Agent 核心引擎

### 目标
实现自建 Agent Loop（里程碑 1），让 Agent 能通过 Tool Calling 自主完成完整任务流程。

### 具体任务

1. **安装 LLM SDK**：`@anthropic-ai/sdk`

2. **Agent Tool Registry 实现**（`agent-tool-registry.ts`）
   - 将各 Service 的方法封装为 Anthropic Tool 格式（name、description、input_schema）
   - 感知类 Tools：`read_user_profile`、`read_feedback_history`、`query_memory`
   - 行动类 Tools：`collect_wechat`、`filter_and_dedup`、`score_contents`、`generate_summary`、`batch_generate_summaries`
   - 推送类 Tools：`send_daily_digest`
   - 记忆类 Tools：`store_memory`、`analyze_source_quality`、`suggest_source_change`

3. **自建 Agent Loop**（`agent.service.ts`）
   - 直接调用 `@anthropic-ai/sdk` 的 `messages.create`
   - 手写循环：发送消息 → 解析 tool_use blocks → 执行 Tools → 拼装 tool_result → 回传
   - maxSteps 限制（15 步）
   - 并行 Tool 执行（Promise.all）
   - Tool 执行失败时返回 is_error，让 Agent 自行决策
   - 消息列表裁剪（上下文管理）

4. **Agent System Prompt 设计**
   - 角色定义（智能信息管家）
   - 行为准则（先了解用户、智能采集、质量优先、自我审视、记录经验）
   - 用户画像注入
   - 决策约束（3-7 条推送、相关性 > 60）

5. **Agent 决策日志**
   - 每步记录：思考内容、Tool 调用、参数、返回值、耗时
   - 写入 `agent_logs` 表

6. **兜底安全网**
   - Agent 执行失败/未产出有效推送时，降级为规则采集 → 过滤 → 推送 Top 5

7. **Agent API**
   - `POST /api/agent/run`：手动触发 Agent 执行（调试用）
   - `GET /api/agent/logs`：查询 Agent 执行日志
   - `GET /api/agent/logs/:sessionId`：查询单次执行的完整步骤

### 环境变量（.env）
```
ANTHROPIC_API_KEY=      # Claude API Key（手动填充）
```

### 验证标准
- Agent 能自主调用 Tool 完成采集 → 过滤 → 推送的完整流程
- Agent 决策日志完整记录每一步
- Tool 执行失败时 Agent 能降级处理
- 达到 maxSteps 上限时能正常退出

---

## 会话 4：内容处理 Pipeline

### 目标
实现内容处理全链路：过滤去重、多维度评分、LLM 摘要生成、邮件推送。

### 具体任务

1. **FilterService 实现**（`filter.service.ts`）
   - URL/external_id 强去重
   - 标题 simhash 弱去重
   - 最小长度过滤（100 字）
   - 黑名单关键词/作者过滤
   - 时间窗口过滤（默认 7 天）

2. **ScorerService 实现**（`scorer.service.ts`）
   - 相关性评分（0-100）：关键词/标签匹配 + 可选 LLM 判定
   - 质量评分（0-100）：内容长度、结构、来源信誉
   - 时效性评分（0-100）：时间衰减函数
   - 新颖性评分（0-100）：与最近 7 天已推送内容的标题相似度
   - 可操作性评分（0-100）：可选 LLM 判定
   - 加权综合分：`final_score = Σ weight_i * score_i`（默认权重：相关性 0.45、质量 0.20、时效 0.20、新颖 0.10、可操作 0.05）
   - 评分结果写入 `content_scores` 表

3. **SummaryService 实现**（`summary.service.ts`）
   - LLM 摘要生成（仅对 Top K 调用，控成本）
   - Prompt 模板：基于用户画像生成个性化摘要 + 行动建议
   - 输出 JSON 结构：summary、relevance_score、key_points、action_suggestions、content_type、tags
   - 缓存幂等（同一 content_id 不重复生成）
   - LLM 失败降级为规则摘要（标题 + 正文前 200 字）

4. **邮件推送实现**（`notification/channels/email.channel.ts`）
   - 安装 `nodemailer`
   - 从 `.env` 读取 SMTP 配置
   - 每日精选邮件模板（HTML 格式：标题、来源、评分、摘要、行动建议、原文链接）
   - `NotificationService` 整合推送逻辑

5. **DigestService 实现**（`digest.service.ts`）
   - 组装每日精选内容
   - 渲染推送模板
   - 记录推送历史

6. **FeedbackService 实现**（`feedback.service.ts`）
   - `POST /api/contents/:id/feedback`：提交反馈（useful/useless/save/ignore）
   - 反馈数据入库

7. **MemoryService 基础实现**（`memory.service.ts`）
   - 存储/查询记忆
   - 支持类型：decision_experience、preference_change、source_quality、insight

### 验证标准
- 采集到的内容能正确去重过滤
- 评分结果可解释（有分数拆解）
- LLM 摘要质量合格（有摘要 + 行动建议）
- 邮件推送能发送成功
- 反馈能正确入库

---

## 会话 5：前端基础框架与核心页面

### 目标
搭建前端基础架构（路由、状态管理、UI 库、API 层），实现核心页面。

### 具体任务

1. **安装依赖**
   - `react-router-dom`（路由）
   - `zustand`（状态管理）
   - `tailwindcss` + `@tailwindcss/vite`（样式）
   - `shadcn/ui` 相关依赖（UI 组件库）
   - `axios`（HTTP 客户端）
   - `lucide-react`（图标）

2. **基础架构搭建**
   - Tailwind CSS 配置
   - shadcn/ui 初始化
   - Vite 代理配置（`/api` → `http://localhost:8000`）
   - API Client 封装（axios 实例、错误处理、拦截器）
   - 路由配置（10 个页面路由）

3. **Zustand Store 实现**
   - `useUserStore`：用户信息、画像、偏好
   - `useContentStore`：内容列表、今日精选
   - `useSourceStore`：数据源列表、统计

4. **API 层实现**
   - `api/user.ts`：注册、获取/更新画像
   - `api/source.ts`：来源 CRUD、统计
   - `api/content.ts`：内容列表、详情、精选、反馈

5. **Layout 组件**
   - `Layout.tsx`：整体页面布局（顶部导航 + 侧边栏 + 内容区）
   - `Header.tsx`：顶部导航栏
   - `Sidebar.tsx`：侧边导航菜单

6. **首页 - 今日精选**（`HomePage.tsx`）
   - 精选内容卡片列表（标题、来源、评分、摘要、行动建议、原文链接）
   - 评分指示器组件（分数拆解可视化）
   - 反馈按钮组（有用/无用/收藏/忽略）

7. **数据源管理页面**（`SourcesPage.tsx` + `AddSourcePage.tsx`）
   - 数据源列表（卡片式，显示类型、名称、状态、质量分、统计）
   - 添加数据源表单（类型选择「微信公众号」、输入 fakeid/名称、验证）
   - 数据源暂停/删除操作

### 验证标准
- 页面路由正常跳转
- 能从后端 API 加载数据并展示
- 今日精选页面展示内容完整
- 数据源管理 CRUD 操作可用

---

## 会话 6：前端交互与 Agent 闭环

### 目标
完成剩余前端页面，实现用户反馈闭环和 Agent 执行可观测性，完整联调。

### 具体任务

1. **用户画像页面**（`ProfilePage.tsx`）
   - 职业角色、技术栈、经验年限编辑
   - 兴趣标签管理（主要兴趣、次要兴趣、排除标签）
   - 内容偏好设置（深度、形式、语言、时效性）

2. **偏好设置页面**（`PreferencesPage.tsx`）
   - 推送频率设置
   - 推送渠道配置（邮件地址）
   - 免打扰时段设置
   - 评分权重自定义

3. **信息流页面**（`FeedPage.tsx`）
   - 全部内容列表（带筛选/搜索/分页）
   - 内容详情弹窗/页面
   - 反馈交互

4. **Agent 洞察页面**（`InsightsPage.tsx`）
   - Agent 执行日志查看（按日期列表、展开查看每步详情）
   - Agent 建议列表（来源优化建议、兴趣发现建议）
   - 建议确认/拒绝操作

5. **阅读历史 + 收藏页面**（`HistoryPage.tsx` + `SavedPage.tsx`）

6. **系统设置页面**（`SettingsPage.tsx`）
   - 手动触发采集/Agent 执行
   - 系统状态查看

7. **定时任务**（后端 `scheduler.service.ts`）
   - 安装 `@nestjs/schedule`
   - 每日定时触发 Agent 执行
   - 定时采集任务

8. **完整联调**
   - 前端 → 后端 → 采集 → Agent → 推送 全链路验证
   - 用户反馈 → Agent 记忆 → 下次推送调整 闭环验证

### 验证标准
- 所有页面功能完整可用
- Agent 执行日志可在前端查看
- 反馈后 Agent 下次执行能参考反馈历史
- 定时任务正常触发

---

## 执行建议

1. **按顺序执行**：会话 1 → 2 → 3 → 4 → 5 → 6，每个会话依赖前一个的产出
2. **每个会话开始时**：告诉 AI "执行《微信公众号Agent实现任务拆分》中的会话 N"，并将此文档作为上下文附带
3. **关键密钥**：在开始会话 2 前，请先在 `.env` 中填充 `WECHAT_TOKEN` 和 `WECHAT_COOKIE`；在开始会话 3 前填充 `ANTHROPIC_API_KEY`
4. **增量验证**：每完成一个会话后，建议启动项目验证该会话的交付标准，再进入下一个
