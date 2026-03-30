/**
 * daily-digest-email 上下文收集脚本
 *
 * 通过 SKILL.md 中的 !`node scripts/gather_context.js` 语法调用。
 * 本脚本在 Prompt 发送给 LLM 之前执行，stdout 会替换到 Prompt 对应位置。
 *
 * 典型用途：
 * - 收集运行时动态信息（系统状态、时间、环境检查等）
 * - 注入不适合写在 SKILL.md 静态模板中的动态上下文
 * - 预处理外部数据（读取文件、调用 API 等）
 *
 * 环境变量（由 SkillPromptService.processScriptInjections 注入）：
 *   SKILL_ID, SKILL_NAME, SKILL_DIR, USER_ID, SESSION_ID, SKILL_PARAMS, SKILL_SETTINGS
 */

const now = new Date();
const hour = now.getHours();

// 1. 时段判断 —— 帮助 AI 决定邮件风格
let timeSlot;
if (hour < 9) {
  timeSlot = '早间 🌅（用户可能刚开始工作，适合简短精炼的摘要）';
} else if (hour < 12) {
  timeSlot = '上午 ☀️（用户工作中，适合重点突出的摘要）';
} else if (hour < 14) {
  timeSlot = '午间 🍽️（午休时间，适合轻松有趣的风格）';
} else if (hour < 18) {
  timeSlot = '下午 🌤️（工作高峰期，适合可执行的行动建议）';
} else {
  timeSlot = '晚间 🌙（下班时间，适合详细深度的总结）';
}

// 2. 用户参数解析
let userParams = {};
try {
  userParams = JSON.parse(process.env.SKILL_PARAMS || '{}');
} catch { /* ignore */ }

// 3. 输出动态上下文（stdout → 替换到 Prompt 中）
const lines = [
  `**⏰ 🚀 🚀 🚀 执行时间**: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
  `**📍 时段**: ${timeSlot}`,
  `**👤 用户**: ${process.env.USER_ID || '未知'}`,
  `**🔧 Skill**: ${process.env.SKILL_NAME || '未知'} (${process.env.SKILL_ID || '?'})`,
  `**📂 会话**: ${process.env.SESSION_ID || '无'}`,
];

// 如果用户传了自定义参数，也输出
const customKeys = Object.keys(userParams).filter((k) => !k.startsWith('_'));
if (customKeys.length > 0) {
  lines.push(`**📝 自定义参数**: ${customKeys.map((k) => `${k}=${userParams[k]}`).join(', ')}`);
}

// 直接输出到 stdout
console.log(lines.join('\n'));
