# 📰 News Agent — 智能新闻聚合与推送系统

基于 LLM Agent 的**个人信息管家**。根据用户画像自动采集多源文章（微信公众号 + GitHub 热点），经 AI 评分、摘要后个性化推送到邮箱，并通过记忆系统持续自我优化。Agent 基于 OpenAI Function Calling 协议，在 Agent Loop 中自主编排 16 种工具完成采集→评分→摘要→推送全流程。

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

---

## ✨ 核心特性

- **🤖 LLM Agent** — 基于 Function Calling 的 Agent Loop，LLM 自主编排 16 种工具完成全流程，支持 3 种运行模式（每日精选 / GitHub 热点 / 分析模式）
- **🔌 可插拔 Skills 系统** — 对标 Claude Code Skills 标准格式，支持从 Git 仓库动态安装 Skill，渐进式加载（description → 完整 prompt → references），安全沙箱执行脚本
- **📡 多源内容采集** — 微信公众号（正文抓取、限流、Token 过期检测）+ GitHub 热点（Trending/Topics 页面解析、多维度采集）
- **🧠 双层评分体系** — 规则预评分（五维度加权）+ AI 深度评分（基于用户画像），自动覆盖合并
- **✍️ AI 个性化摘要** — 基于用户画像和兴趣标签生成定制化摘要、关键要点和行动建议
- **📧 双模板邮件推送** — 每日精选（高分展开/低分折叠）+ GitHub 热点专属模板（Star 数、语言、趋势来源）
- **🔄 LLM 容错机制** — 主动限速（滑动窗口 RPM 控制）+ 被动重试（限频 4 级重试 + 自动切换备用模型）+ 告警邮件通知，Agent 失败时不发低质量内容
- **💾 Agent 记忆** — 持久化存储决策经验、来源质量评估、偏好变化，跨会话可检索
- **🛡️ 脚本安全沙箱** — Skill 脚本在受限环境执行（环境变量白名单清洗、路径约束、命令注入防护、超时控制）
- **🎨 完整管理前端** — 10+ 页面，支持数据源管理、用户画像编辑、Skill 管理与安装、Agent 执行日志回溯等
- **🧪 测试模式** — 通过环境变量 `COLLECT_MAX_SOURCES` 限制采集源数量，不改线上数据即可快速测试全流程

---

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (:3000)                      │
│       React 19 + Vite 7 + Zustand 5 + shadcn/ui         │
│       10 个页面 · 40+ 个组件 · Tailwind CSS 暗色模式      │
└───────────────────────┬──────────────────────────────────┘
                        │ /api proxy
┌───────────────────────▼──────────────────────────────────┐
│                     Backend (:8000)                       │
│               NestJS 11 + TypeORM + OpenAI SDK           │
│  ┌────────────────────────────────────────────────────┐  │
│  │       Agent Loop（最多 25 步自主决策 × 3 模式）      │  │
│  │                                                    │  │
│  │  感知工具(4)       行动工具(7)      推送+记忆(5)    │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│  │  │UserProfile │  │Collect(微信) │  │DailyDigest │  │  │
│  │  │Feedback    │  │Collect(GH)  │  │GH Trending │  │  │
│  │  │QueryMemory │  │Filter+Dedup │  │StoreMemory │  │  │
│  │  │GetSources  │  │Score(规则)   │  │SourceQA    │  │  │
│  │  │            │  │Summary(AI)  │  │SourceSuggest│ │  │
│  │  │            │  │BatchSummary │  │            │  │  │
│  │  │            │  │GetContents  │  │            │  │  │
│  │  └────────────┘  └─────────────┘  └────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Scheduler: 每分钟轮询用户推送时间 → 自动触发 Agent       │
│  独立流程: 每日精选 Agent + GitHub 热点 Agent 并行执行     │
└────────────┬──────────────────────────┬──────────────────┘
             │                          │
      ┌──────▼──────┐           ┌───────▼───────┐
      │ MySQL (:3306)│           │ Redis (:6379) │
      │  9 个实体表   │           │  凭证缓存/TTL  │
      └─────────────┘           └───────────────┘
```

---

## 📂 项目结构

```
news_agent/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   ├── database/entities/    # 11 个 TypeORM 实体（User/Content/Score/Memory/SkillConfig 等）
│   │   │   ├── config/               # 全局配置工厂
│   │   │   ├── llm-rate-limiter/     # LLM 请求主动限速（滑动窗口）
│   │   │   └── redis/                # Redis 全局模块
│   │   └── modules/
│   │       ├── agent/                # 🤖 Agent Loop + Tool Registry（16 个工具，3 种模式）
│   │       ├── collector/            # 📡 内容采集（微信公众号 + GitHub Trending/Topics）
│   │       ├── content/              # 📄 内容 CRUD + 关联查询
│   │       ├── digest/               # 📰 推送记录管理
│   │       ├── feedback/             # 👍 用户反馈收集
│   │       ├── filter/               # 🔍 六层过滤链（URL/标题/长度/时间/黑名单/相似度）
│   │       ├── memory/               # 🧠 Agent 记忆（关键词检索）
│   │       ├── notification/         # 📧 邮件推送（SMTP + 双模板：每日精选 / GitHub 热点）
│   │       ├── scheduler/            # ⏰ 定时任务（分钟轮询 + 防重复机制）
│   │       ├── scorer/               # 📊 五维度规则评分
│   │       ├── skill/                # 🔌 Skills 系统（解析/注册/沙箱执行/Git 安装/增强注入）
│   │       ├── source/               # 📡 数据源管理
│   │       ├── summary/              # ✍️ AI 摘要 + 深度评分（LLM 调用）
│   │       └── user/                 # 👤 用户管理
│   └── skills/                       # 📦 Skill 定义文件目录（SKILL.md + scripts/ + references/）
│       ├── _template/                # Skill 编写模板
│       ├── daily-digest-email/       # 每日浓缩邮件 Skill
│       └── reading-digest/           # 阅读笔记 Skill
├── frontend/src/
│   ├── api/                          # 7 个 API 模块（Axios 封装 + 拦截器）
│   ├── components/                   # 40+ 个 UI 组件（shadcn/ui 基础 + 业务组件）
│   │   ├── ui/                       # 17 个 shadcn/ui 基础组件
│   │   ├── layout/                   # 响应式布局（Sidebar + Header）
│   │   ├── content/                  # 内容卡片/详情/反馈
│   │   ├── source/                   # 数据源管理/微信搜索/GitHub 添加
│   │   ├── profile/                  # 画像编辑/兴趣标签
│   │   ├── agent/                    # Agent 洞察
│   │   └── common/                   # 评分指示器/标签选择器
│   ├── pages/                        # 10+ 页面（含 Skills 管理页）
│   ├── store/                        # 4 个 Zustand Store（User/Content/Source/Skill）
│   ├── types/                        # 前后端类型契约
│   └── utils/                        # 日期/评分/状态工具函数
├── docker-compose.yml
└── start.sh                          # 一键部署脚本
```

---

## 🤖 Agent 机制详解

### 三种运行模式

| 模式 | 入口方法 | 工具集 | 说明 |
|------|---------|--------|------|
| **每日精选** | `runDailyDigest(userId)` | 全部 16 个工具 | 全量采集→评分→摘要→推送，含记忆和来源分析 |
| **GitHub 热点** | `runGithubTrending(userId)` | 12 个工具（排除微信相关） | 独立的 GitHub 热点采集推送流程 |
| **分析模式** | `runAnalysisOnly(userId)` | 部分工具（跳过采集） | 对已采集内容进行评分摘要，不重新采集 |

### Agent Loop 流程

```
┌─ for (step = 0; step < 25; step++) ────────────────────────┐
│                                                             │
│  1. 调用 LLM（tool_choice: 'auto'）                         │
│     ↓                                                       │
│  2. LLM 返回 tool_calls?                                    │
│     ├─ 无 → finish_reason=stop → 任务完成，退出循环          │
│     └─ 有 → 解析工具名称和参数                               │
│            ↓                                                │
│  3. 并行执行所有 tool_calls（Promise.all）                    │
│     ↓                                                       │
│  4. 工具结果智能截断（>8000 字符时保留关键 ID）               │
│     ↓                                                       │
│  5. 结果注入消息历史 → Token 管理（裁剪旧消息）               │
│     ↓                                                       │
│  6. 回到步骤 1                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

兜底安全网：循环结束后检测是否完成推送，未完成则自动推送已分析内容或发告警邮件
```

### LLM 主动限速

为防止频繁触发 LLM API 限频（429），系统内置了基于**滑动窗口**的主动限速机制。所有 LLM 调用点（`AgentService`、`SummaryService`）共享同一个全局限流器实例。

- **只影响外部 LLM API 调用**：限流器仅作用于 `chat.completions.create` 请求，不影响数据库查询、HTTP 接口、邮件发送、定时任务等其他功能
- **不丢弃请求**：达到限速阈值时，后续请求自动排队等待，不会跳过或丢弃任何 AI 分析任务
- **配置灵活**：通过 `.env` 中的 `LLM_RPM` 控制
  - `LLM_RPM=10`（默认）— 每分钟最多 10 次 LLM 请求
  - `LLM_RPM=-1` — 禁用限流，所有请求立即放行
  - `LLM_RPM=0` 或未设置 — 使用默认值 10

### LLM 被动限频重试策略

```
首次调用（当前模型）
  ↓ 429 限频
等 30s → 同模型重试
  ↓ 再次 429
切换到备用模型（LLM_FALLBACK_MODEL）
  ↓ 再次 429
等 60s → 最后重试
  ↓ 全部失败
抛出异常 + 发送限频告警邮件（1 小时冷却去重）
```

### Agent 工具清单（16 个）

| 类别 | 工具名 | 说明 |
|------|--------|------|
| **感知** | `read_user_profile` | 读取用户画像、兴趣标签和偏好设置 |
| **感知** | `read_feedback_history` | 读取最近的用户反馈记录 |
| **感知** | `query_memory` | 按关键词查询历史决策经验 |
| **感知** | `get_user_sources` | 获取用户配置的数据源列表 |
| **行动** | `collect_wechat` | 采集微信公众号文章（含正文抓取） |
| **行动** | `collect_github` | 采集 GitHub 热点仓库（Trending/Topics） |
| **行动** | `filter_and_dedup` | 六层过滤链去重 |
| **行动** | `score_contents` | 五维度规则预评分 |
| **行动** | `generate_summary` | 单篇 AI 摘要 + 深度评分 |
| **行动** | `batch_generate_summaries` | 批量 AI 摘要（并发控制，每批 3 篇） |
| **行动** | `get_recent_contents` | 获取内容列表（支持筛选/分页） |
| **推送** | `send_daily_digest` | 发送每日精选邮件推送 |
| **推送** | `send_github_trending` | 发送 GitHub 热点趋势专属邮件 |
| **记忆** | `store_memory` | 存储决策经验/偏好变化/洞察 |
| **记忆** | `analyze_source_quality` | 查询来源质量历史数据 |
| **记忆** | `suggest_source_change` | 建议新增/移除数据源 |

---

## 📊 评分体系

### 第一层：规则预评分（Scorer 模块）

| 维度 | 权重 | 评分逻辑 |
|------|------|---------|
| **相关性** | 45% | 用户画像关键词/标签匹配，标题匹配额外加分 |
| **质量** | 20% | 内容长度、标题/作者/URL 完整性、代码块检测 |
| **时效性** | 20% | 时间衰减函数（6h 内 100 分 → 7 天后 30 分） |
| **新颖性** | 10% | Jaccard 相似度对比已推送标题（bigram 分词） |
| **可操作性** | 5% | 教程/实践关键词检测 + 代码命令行识别 |

### 第二层：AI 深度评分（Summary 模块）

基于用户画像 + 文章全文，由 LLM 生成综合评分（0-100），自动覆盖规则评分。同时生成个性化摘要、关键要点和行动建议。

---

## 🗄️ 数据模型

| 实体 | 表名 | 说明 |
|------|------|------|
| `User` | `users` | 用户画像、兴趣标签、推送偏好、通知设置 |
| `Source` | `sources` | 数据源配置（类型/URL/采集统计） |
| `Content` | `contents` | 采集的原始内容（标题/正文/元数据/externalId 去重） |
| `ContentScore` | `content_scores` | 评分记录（多维度得分/来源标记 rule/ai） |
| `UserContentInteraction` | `user_content_interactions` | 用户交互（AI 摘要/建议/阅读状态/收藏） |
| `Feedback` | `feedbacks` | 用户反馈（useful/not_useful/save） |
| `Memory` | `memories` | Agent 记忆（决策经验/来源质量/偏好变化/洞察） |
| `Digest` | `digests` | 推送记录（Markdown+HTML 渲染/发送时间） |
| `AgentLog` | `agent_logs` | Agent 执行日志（session/action/input/output/耗时） |
| `SkillConfig` | `skill_configs` | Skill 用户配置（启用状态/settings 覆盖值，userId+skillId 联合唯一） |
| `SkillExecution` | `skill_executions` | Skill 执行记录（状态/输入输出/步数/Token/耗时） |

所有实体使用 UUID 主键，通过 `userId` 关联到 `User`，级联删除。

---

## 🔌 Skills 可插拔技能系统

对标 **Claude Code / CodeBuddy Skills** 标准格式，为 Agent 扩展可插拔能力。

### Skill 标准格式

每个 Skill 是 `backend/skills/` 下的一个目录，核心是 `SKILL.md` 文件：

```
skills/
└── daily-digest-email/
    ├── SKILL.md          # frontmatter（name + description）+ Markdown 正文（Agent 完整指令）
    ├── scripts/          # 可执行脚本（pre_run/post_run 生命周期 + Agent 可调用工具）
    ├── references/       # 参考文档（按需加载到 Agent 上下文）
    └── assets/           # 静态资源
```

**SKILL.md** frontmatter 极简设计（只有 `name` + `description`），所有复杂指令都在 Markdown 正文中：

```yaml
---
name: daily-digest-email
description: >
  每日内容浓缩邮件 Skill。文章采集分析完成后触发此技能。
---

# 你的 Agent 指令...
```

### 渐进式加载（三阶段）

| 阶段 | 何时加载 | 加载什么 | 上下文成本 |
|------|---------|---------|-----------|
| 第一阶段 | 会话启动时 | 所有已启用 Skill 的 name + description | 低 |
| 第二阶段 | AI 判断需要时 | SKILL.md 完整 Markdown 正文（通过 `load_skill` 工具） | 按需 |
| 第三阶段 | 需要更多细节时 | references/ 目录下的参考文档 | 按需 |

### 两种脚本能力

| 模式 | 语法 | 执行时机 | 说明 |
|------|------|---------|------|
| 预处理注入 | `` !`node scripts/gather.js` `` | Prompt 构建阶段 | 命令 stdout 静态替换到 Prompt 中 |
| 动态工具 | `scripts/*.{js,ts,sh}` | Agent 推理阶段 | 自动注册为 Agent 可调用工具 |

### 从 Git 仓库安装 Skill

用户只需提供 Git 仓库地址，系统自动 clone 并注册：

```bash
# API 安装
curl -X POST http://localhost:8000/api/skills/install \
  -H "Content-Type: application/json" \
  -d '{
    "gitUrl": "https://github.com/user/my-skill.git",
    "branch": "main",
    "directory": "skills/my-custom-skill"
  }'

# 卸载
curl -X DELETE http://localhost:8000/api/skills/my-custom-skill/uninstall

# 更新（重新 clone）
curl -X POST http://localhost:8000/api/skills/my-custom-skill/update
```

前端 Skills 管理页面也提供可视化安装入口。

### Skills API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/skills` | 获取 Skill 列表 |
| `GET` | `/api/skills/:id` | 获取 Skill 详情 |
| `POST` | `/api/skills/:id/run` | 手动执行 Skill |
| `POST` | `/api/skills/:id/enable` | 启用 Skill |
| `POST` | `/api/skills/:id/disable` | 禁用 Skill |
| `POST` | `/api/skills/install` | 从 Git 仓库安装 Skill |
| `DELETE` | `/api/skills/:id/uninstall` | 卸载 Git Skill |
| `POST` | `/api/skills/:id/update` | 更新 Git Skill |
| `POST` | `/api/skills/reload` | 热重载 |

---

## 🛡️ 脚本安全沙箱

所有 Skill 脚本通过 `SkillSandboxService` 在受限环境中执行：

| 安全策略 | 说明 |
|---------|------|
| **命令注入防护** | 禁止 shell 元字符（`; && \|\| \| > < $()` 等） |
| **路径约束** | 脚本必须在 Skill 目录内，禁止路径穿越（`..`）+ 符号链接检查 |
| **环境变量清洗** | 只透传白名单变量（PATH、HOME、NODE_ENV 等），不暴露系统敏感信息 |
| **文件操作受限** | 脚本可写范围限制在 `tmp/` 和 `output/` 目录，通过 `SKILL_WRITABLE_DIRS` 环境变量声明 |
| **网络可用但有超时** | 允许网络请求（HTTP/HTTPS），整体脚本超时 30 秒 |
| **白名单解释器** | 仅允许 `node`、`npx tsx`、`bash`、`cat` 四种解释器 |
| **资源限制** | 超时 30s + stdout 最大 1MB |
| **Git 安装安全** | 只允许 HTTPS URL、禁止 URL 含密码、shallow clone、目录大小限制 50MB |

---

## 🚀 快速开始

### 环境要求

- **Node.js >= 22**（NestJS 11 + TypeScript 5.7 + ES2023，仅本地开发需要）
- Docker & Docker Compose
- 兼容 OpenAI API 的 LLM 服务（DeepSeek、OpenRouter、OpenAI 等）
- SMTP 邮箱服务（用于邮件推送）

### 前置准备：启动 MySQL 和 Redis 容器

项目不内置数据库容器，需要先创建独立的 MySQL 和 Redis 容器：

```bash
# MySQL 5.7
docker run -d \
  --name mysql-container \
  -e MYSQL_ROOT_PASSWORD=你的密码 \
  -p 3306:3306 \
  -v ~/docker/mysql_data:/var/lib/mysql \
  mysql:5.7

# 创建项目数据库
docker exec mysql-container mysql -u root -p你的密码 \
  -e "CREATE DATABASE IF NOT EXISTS news_agent DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Redis 7
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -v ~/docker/redis/data:/data \
  redis:7 \
  redis-server --requirepass "你的密码" --appendonly yes
```

日常启动/停止：

```bash
docker start mysql-container redis-container    # 启动
docker stop mysql-container redis-container     # 停止
docker ps --filter "name=mysql-container" --filter "name=redis-container"  # 查看状态
```

### 方式一：Docker Compose 部署（推荐）

```bash
git clone https://github.com/your-username/news-agent.git
cd news-agent

# 1. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 LLM API Key、SMTP、数据库连接等配置

# 2. 一键启动
bash start.sh
```

`start.sh` 会自动：
1. 启动 MySQL/Redis 外部容器，等待 MySQL 就绪
2. 将 `.env` 中的 `DATABASE_HOST` / `REDIS_HOST` 替换为 Docker 容器名（原始值备份到 `.env.hostbak`）
3. 创建共享网络 `news_agent_net`，加入所有容器
4. `docker-compose up -d --build` 构建并启动前后端

> 💡 **无需手动修改 HOST**：`start.sh` 启动时自动替换为容器名，停止时自动恢复。`.env` 中始终保持你的实际 IP 即可。

```bash
bash start.sh                    # 首次启动全部服务
bash start.sh restart            # 重启全部（重新构建）
bash start.sh restart backend    # 仅重启后端
bash start.sh restart frontend   # 仅重启前端
bash start.sh stop               # 停止全部（自动恢复 .env）
bash start.sh logs backend       # 查看后端日志
bash start.sh status             # 查看服务状态
```

访问：前端 http://localhost:3000 · 后端 API http://localhost:8000

### 方式二：本地开发

```bash
# 确认 Node 版本 >= 22
node -v

# 后端
cd backend
npm install
npm run start:dev     # ⚠️ 必须用 nest start，不要用 ts-node！

# 前端（新终端）
cd frontend
npm install
npm run dev
```

前端 http://localhost:3000 · 后端 http://localhost:8000

> **⚠️ 注意**：后端 tsconfig 配置了 `"module": "nodenext"`，导入使用 `.js` 扩展名。`ts-node` 无法正确解析，务必用 `nest start` 启动。

---

## ⚙️ 环境变量

在 `backend/.env` 中配置：

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `DATABASE_HOST` | ✅ | MySQL 地址 |
| `DATABASE_PORT` | ✅ | MySQL 端口（默认 3306） |
| `DATABASE_USER` | ✅ | MySQL 用户名 |
| `DATABASE_PASSWORD` | ✅ | MySQL 密码 |
| `DATABASE_NAME` | ✅ | 数据库名（如 `news_agent`） |
| `REDIS_HOST` | ✅ | Redis 地址 |
| `REDIS_PORT` | ✅ | Redis 端口（默认 6379） |
| `REDIS_PASSWORD` | ✅ | Redis 密码 |
| `LLM_URL` | ✅ | LLM API 地址（OpenAI 兼容格式） |
| `LLM_API_KEY` | ✅ | LLM API Key |
| `LLM_MODEL` | ✅ | 主模型名称（如 `deepseek-chat`、`gpt-4o`） |
| `LLM_FALLBACK_MODEL` | | 备用模型（限频时自动切换） |
| `LLM_RPM` | | 每分钟最大 LLM 请求数，默认 `10`；设为 `-1` 禁用限流 |
| `ALERT_EMAIL` | | 限频告警邮箱（收到 API 限频时发送告警通知） |
| `SMTP_HOST` | 📧 | SMTP 邮件服务器地址 |
| `SMTP_PORT` | 📧 | SMTP 端口 |
| `SMTP_USER` | 📧 | SMTP 用户名 |
| `SMTP_PASSWORD` | 📧 | SMTP 密码/授权码 |
| `SMTP_FROM` | 📧 | 发件人邮箱 |
| `WECHAT_TOKEN` | 🔧 | 微信公众号采集 Token |
| `WECHAT_COOKIE` | 🔧 | 微信公众号 Cookie |
| `WECHAT_MAX_AGE_DAYS` | | 微信文章最大保留天数，默认 7 天 |
| `GITHUB_TOKEN` | 🔧 | GitHub Personal Access Token |
| `COLLECT_MAX_SOURCES` | 🧪 | 测试模式：每种类型最多采集的源数量（不设或 `0` 表示不限制） |

> ✅ 必填 · 📧 邮件推送需要 · 🔧 对应采集源需要 · 🧪 测试/开发用

---

## 🧪 测试模式

通过环境变量 `COLLECT_MAX_SOURCES` 可在不修改线上数据的情况下快速测试全流程。

```bash
# 在 backend/.env 中设置
COLLECT_MAX_SOURCES=10   # 每种类型最多采集 10 个源
```

| 配置 | 效果 |
|------|------|
| `COLLECT_MAX_SOURCES=10` | 微信公众号最多采集 10 个，GitHub 最多采集 10 个 |
| `COLLECT_MAX_SOURCES=5` | 各类型截断为 5 个 |
| `COLLECT_MAX_SOURCES=0` 或不设 | 不限制，采集所有 active 数据源 |

生效时日志会输出 `[测试模式]` 前缀：

```
[测试模式] COLLECT_MAX_SOURCES=10，各类型源数量: wechat=25, github=3
[测试模式] wechat 类型源从 25 截断为 10 个
```

也可通过前端「系统设置」页面或 API 手动触发 Agent 运行：

```bash
# 手动触发每日精选
curl -X POST http://localhost:8000/api/agent/run?userId=YOUR_USER_ID

# 手动触发 GitHub 热点
curl -X POST http://localhost:8000/api/agent/run-github?userId=YOUR_USER_ID
```

---

## 📧 邮件推送效果

### 每日精选邮件

推送邮件自动按 AI 评分分层展示：

- **🔥 精选推荐**（评分 ≥ 60）— 完整展开，包含 AI 摘要、五维度评分拆解、行动建议、阅读原文按钮
- **📂 更多内容**（评分 < 60）— `<details>` 折叠展示，包含摘要，一行一篇紧凑排列

### GitHub 热点邮件

独立的 GitHub 专属模板：

- 展示仓库 fullName、描述、编程语言、Star 数、新增 Star、Fork 数、趋势来源
- AI 生成的仓库分析摘要和行动建议
- 按 Star 数排序

支持 HTML 渲染 + 纯文本降级，兼容各主流邮件客户端。

---

## 🖥️ 前端页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 今日精选 | `/` | 查看当日 AI 推送的精选文章，按评分分区展示 |
| 信息流 | `/feed` | 浏览所有已采集文章，支持筛选和分页 |
| 数据源管理 | `/sources` | 添加/删除数据源，查看采集统计，微信搜索添加，GitHub 源添加 |
| Agent 洞察 | `/insights` | 查看 Agent 执行历史，回溯每步决策和工具调用 |
| Skills 管理 | `/skills` | Skill 列表、启用/禁用、手动执行、从 Git 安装/卸载、执行记录 |
| 用户画像 | `/profile` | 编辑个人画像、专业领域、经验水平 |
| 偏好设置 | `/preferences` | 管理兴趣标签、排除标签、阅读偏好 |
| 阅读历史 | `/history` | 查看反馈过的文章记录 |
| 我的收藏 | `/saved` | 收藏的文章列表 |
| 系统设置 | `/settings` | SMTP 邮件配置、微信凭证管理、手动触发 Agent |
| 添加数据源 | `/add-source` | 手动添加数据源表单 |

---

## ⏰ 定时任务

| 任务 | 调度方式 | 说明 |
|------|---------|------|
| Agent 全流程 | **每分钟轮询**，匹配用户设定的 `notifyTime`（HH:MM 北京时间） | 自动触发每日精选 Agent + GitHub 热点 Agent |
| 周报反思 | 每周日 10:00 | 预留功能，暂未实现 |

**调度机制**：
- 每分钟遍历所有用户，比较 `notifyTime` 与当前北京时间
- 同一用户当天只执行一次（`todayExecutedUsers` 去重）
- 每日精选和 GitHub 热点独立防重、独立执行
- 支持 `detailedNotify` 偏好：开启后发送 Agent 启动通知和失败详情邮件

> 也可通过前端「系统设置」页面或 API `POST /api/agent/run` 手动触发。

---

## 🔧 技术栈明细

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | 11 | Web 框架 + 模块化 DI |
| TypeORM | 0.3 | ORM + 实体管理 |
| MySQL | 5.7 | 关系型数据库 |
| Redis (ioredis) | 5.9 | 微信凭证缓存 |
| OpenAI SDK | 6.x | LLM 调用（兼容所有 OpenAI API 格式） |
| @nestjs/schedule | 6.x | Cron 定时任务 |
| Cheerio | 1.2 | 微信文章/GitHub 页面 HTML 解析 |
| Nodemailer | 8.x | SMTP 邮件发送 |
| Axios | 1.13 | HTTP 请求（微信/GitHub API 调用） |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| Vite | 7 | 构建工具 |
| TypeScript | 5.9 | 类型安全 |
| Zustand | 5 | 轻量状态管理（3 个 Store） |
| shadcn/ui + Radix UI | — | 无头组件库（17 个基础组件） |
| Tailwind CSS | 3.4 | 原子化样式 + 暗色模式 |
| React Router | 7 | 路由管理 |
| Lucide React | — | 图标库 |

---

## 🛣️ 开发现状与路线图

### 当前状态

| 模块 | 状态 | 说明 |
|------|------|------|
| Agent Loop + 16 工具 | ✅ 已完成 | 3 种模式（每日精选/GitHub 热点/分析），含容错和兜底 |
| Skills 可插拔技能系统 | ✅ 已完成 | 对标 Claude Code 标准格式，渐进式加载，Git 安装/卸载/更新 |
| 脚本安全沙箱 | ✅ 已完成 | 环境变量白名单、路径约束、命令注入防护、超时控制 |
| 微信公众号采集 | ✅ 已完成 | 正文抓取、限流、Token 过期检测、自动刷新 |
| GitHub 热点采集 | ✅ 已完成 | Trending（daily/weekly/monthly）+ Topics 页面解析，跨源去重 |
| AI 摘要 + 评分 | ✅ 已完成 | LLM 生成摘要、评分，降级为规则摘要 |
| 邮件推送 | ✅ 已完成 | 双模板（每日精选 + GitHub 热点），纯文本降级 |
| Agent 记忆 | ✅ 已完成 | 基于关键词检索的 MySQL 持久化 |
| 前端管理界面 | ✅ 已完成 | 11 个页面，40+ 组件，含 Skills 管理与安装 |
| 定时调度 | ✅ 已完成 | 分钟轮询 + 用户推送时间匹配 + 防重复 |
| Docker 部署 | ✅ 已完成 | 多阶段构建 + 一键启动脚本 |
| 测试模式 | ✅ 已完成 | 环境变量控制采集源数量，不改线上数据 |
| RSS 采集器 | 🔜 计划中 | 基类已定义，后续实现 |
| 用户认证 | 🔲 未实现 | 当前为单用户硬编码模式 |
| Agent 实时交互 | 🔲 未实现 | 前端 AgentChat 组件为占位 |
| 单元/集成测试 | 🔲 未覆盖 | Jest 已配置但暂无测试用例 |

### 演进路线

| 阶段 | 方案 | 状态 |
|------|------|------|
| Level 0 | 自建 Agent Loop + Function Calling | ✅ 当前 |
| Level 1 | 迁移到 Vercel AI SDK / LangChain | 🔜 计划 |
| Level 2 | 记忆增强（Embedding 向量检索 + 反馈闭环） | 🔜 计划 |
| Level 3 | 多 Agent 协作（采集 Agent + 分析 Agent + 推送 Agent） | 📋 远期 |
| Level 4 | 自主进化（Plan-Execute-Reflect 循环 + 自动策略调整） | 📋 远期 |

---

## 📄 License

MIT
