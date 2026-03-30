---
name: my-custom-skill
description: >
  在这里描述你的 Skill 做什么，以及什么场景下应该触发它。
  描述应该尽可能具体，包含触发关键词和使用场景。
---

# 我的自定义技能

> 在此编写 Agent 的指令。

你是一个...（描述 Agent 的角色和职责）

## 可用工具

列出此 Skill 需要使用的工具：

| 工具 | 用途 |
|------|------|
| `tool_name` | 工具用途说明 |

## 执行流程

请按以下步骤执行：

1. 第一步...
2. 第二步...
3. 第三步...

## 脚本能力

### 模式 1：预处理注入（!`command` 语法）

在 Prompt 发送给 LLM **之前**自动执行命令，将 stdout 输出替换到 Prompt 中。
适合收集运行时信息、预加载动态数据。

用法：在 Markdown 正文中写 `` !`command` ``，例如：

```
当前环境信息：
!`node scripts/gather_context.js`
```

### 模式 2：Agent 推理中按需调用脚本

`scripts/` 目录下的脚本（排除 `pre_run`、`post_run`、`gather_context`）会自动注册为
Agent 可调用的工具。LLM 在推理过程中可以根据需要主动调用它们。

脚本通过环境变量获取上下文：
- `SKILL_ID` — 当前 Skill ID
- `SKILL_DIR` — Skill 目录路径
- `USER_ID` — 用户 ID
- `SESSION_ID` — 会话 ID
- `SCRIPT_ARGS` — 调用时传入的 JSON 参数

工具名格式：`skill_script__{skillId}__{scriptBaseName}`

**示例**：在 SKILL.md 中引导 Agent 使用脚本：
```
如果需要分析趋势数据，请调用 `skill_script__my-skill__analyze_trends` 工具。
```

## 注意事项

- 生命周期脚本（`pre_run.*`、`post_run.*`）会在 Agent Loop 前后自动执行，不需要在此引导
- `!`command`` 在 Prompt 构建阶段执行（静态注入），脚本工具在 Agent Loop 中执行（动态调用）
- 脚本超时 30 秒，stdout 最大 1MB

## 参考资料

如有 `references/` 目录中的参考文档，在这里说明何时需要阅读它们。
