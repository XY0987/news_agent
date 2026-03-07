# AGENTS.md - AI 开发指南

本文档记录项目约定和历史踩坑经验，供 AI 辅助开发时参考，避免重复犯错。

---

## 项目概览

智能新闻聚合与推送系统，前后端分离架构。

- **后端**：NestJS 11 + TypeORM + MySQL + Redis，端口 8000
- **前端**：React 19 + Vite + Zustand + shadcn/ui + TailwindCSS，端口 3000
- **容器化**：Docker Compose（frontend / api / db / redis）

---

## 启动方式

### 后端

```bash
# 必须使用 Node 22+（Node 18 不兼容 NestJS 11）
nvm use 22

# 开发模式（推荐）
cd backend && npm run start:dev

# 或者
npx nest start --watch
```

**绝对不要**用 `ts-node` 或 `npx ts-node` 直接启动后端，原因见下方踩坑记录。

### 前端

```bash
cd frontend && npm run dev
```

---

## 踩坑记录

### 1. Node.js 版本要求

**问题**：NestJS 11 + TypeScript 5.7 + ES2023 target 需要 Node 22+，用 Node 18 启动会报语法错误。

**规则**：启动后端前必须确认 Node 版本 >= 22。

### 2. 禁止用 ts-node 启动后端

**问题**：后端 tsconfig 配置了 `"module": "nodenext"`，导入语句使用 `.js` 扩展名（如 `import ... from './collector.service.js'`）。`ts-node` 默认无法将 `.js` 扩展名解析到对应的 `.ts` 文件，会报 `MODULE_NOT_FOUND` 错误。

**规则**：始终用 `nest start` 或 `nest start --watch` 启动后端，不要用 `ts-node`。

### 3. 后端 API 返回结构必须与前端类型对齐

**问题**：后端 `getTodayDigest` 返回嵌套结构 `{ content: ContentEntity, score, breakdown }`，但前端 `Content` 类型期望扁平结构（直接有 `title`、`score`、`summary` 等字段），导致页面渲染全部为空。

**规则**：
- 新增或修改 API 时，必须先检查前端 `frontend/src/types/index.ts` 中对应的类型定义
- 确保后端返回的数据结构与前端类型完全一致
- 特别注意：`ContentEntity` 本身没有 `score`、`summary`、`sourceName`、`sourceType`、`suggestions` 等字段，这些分散在不同的表/实体中：
  - `score` / `scoreBreakdown` → `content_scores` 表（`ContentScoreEntity`）
  - `summary` / `suggestions` → `user_content_interactions` 表（`UserContentInteractionEntity`）
  - `sourceName` / `sourceType` → `sources` 表（`SourceEntity`）或 `content.metadata` JSON 字段
- API 层负责将多表数据拍扁为前端需要的结构

### 4. 前端字段重命名后需重新保存

**问题**：`UserPreferences` 字段从 `pushTime`/`pushChannels` 改名为 `notifyTime`/`notifyChannels` 后，数据库中已有用户的旧数据仍然是旧字段名，前端读不到值。

**规则**：数据库字段/JSON 键名变更时，要么做数据迁移，要么提示用户重新保存以写入新字段名。不要在前端做旧字段兼容（除非确实需要长期共存）。

### 5. 后端导入使用 .js 扩展名

**问题**：因为 tsconfig 配置了 `"module": "nodenext"` + `"moduleResolution": "nodenext"`，所有相对导入必须带 `.js` 扩展名。

**规则**：在后端新增文件或修改导入时，相对路径导入必须以 `.js` 结尾：
```typescript
// ✅ 正确
import { FooService } from './foo.service.js';

// ❌ 错误
import { FooService } from './foo.service';
import { FooService } from './foo.service.ts';
```

注意：部分现有模块（如 `content.service.ts`）可能没有使用 `.js` 扩展名，这是因为 `nest build`（tsc）编译后可以正常解析。但新代码应统一加上 `.js` 以保持一致性。

---

## 关键架构约定

### 数据库实体与前端类型映射

| 前端 `Content` 字段 | 来源实体 | 来源字段 |
|---|---|---|
| `id`, `title`, `url`, `author`, `publishedAt` | `ContentEntity` | 同名 |
| `sourceName` | `SourceEntity` | `name`（或 `content.metadata.sourceName`） |
| `sourceType` | `SourceEntity` | `type`（或 `content.metadata.sourceType`） |
| `score` | `ContentScoreEntity` | `finalScore` |
| `scoreBreakdown` | `ContentScoreEntity` | `scoreBreakdown` |
| `summary` | `UserContentInteractionEntity` | `summary` |
| `suggestions` | `UserContentInteractionEntity` | `suggestions` |
| `tags` | `ContentEntity` | `metadata.tags` |

### Store 约定（Zustand）

- `useUserStore` — 用户信息、画像、偏好
- `useContentStore` — 内容列表、今日精选、反馈
- `useSourceStore` — 数据源管理

### API 约定

- 所有 API 以 `/api` 为前缀
- 返回格式：`{ data: T }` 或 `{ data: T[], total: number }`
- 用户相关接口通过 `userId` query 参数传递（非 JWT）

### 目录结构

```
backend/src/
├── common/database/entities/   # TypeORM 实体
├── modules/
│   ├── agent/                  # AI Agent 编排
│   ├── collector/              # 内容采集（RSS/GitHub/微信公众号）
│   ├── content/                # 内容 CRUD + 今日精选
│   ├── digest/                 # 日报/周报
│   ├── feedback/               # 用户反馈
│   ├── filter/                 # 内容过滤去重
│   ├── memory/                 # Agent 记忆
│   ├── notification/           # 推送通知
│   ├── scheduler/              # 定时任务
│   ├── scorer/                 # AI 评分
│   ├── source/                 # 数据源管理
│   ├── summary/                # AI 摘要
│   └── user/                   # 用户管理

frontend/src/
├── api/                        # Axios API 封装
├── components/                 # UI 组件
├── pages/                      # 页面组件
├── store/                      # Zustand Store
├── types/                      # TypeScript 类型定义（前后端契约）
└── utils/                      # 工具函数
```

---

## 开发 Checklist

修改后端 API 时：
- [ ] 检查 `frontend/src/types/index.ts` 中对应类型
- [ ] 确保返回数据结构与前端类型一致（扁平化、字段名一致）
- [ ] 如涉及多表数据，在 Service 层做关联查询和数据组装

修改数据库 Entity 时：
- [ ] 同步更新前端类型定义
- [ ] 检查所有引用该 Entity 的 Service 方法

启动服务时：
- [ ] 确认 Node 版本 >= 22（`node -v`）
- [ ] 后端用 `nest start` 启动，不要用 `ts-node`
- [ ] 确认 MySQL 和 Redis 已启动
