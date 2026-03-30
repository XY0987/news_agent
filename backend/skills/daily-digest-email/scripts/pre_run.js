/**
 * daily-digest-email pre_run 测试脚本
 *
 * 用于验证 Skill 脚本执行链路是否正常工作。
 * 执行方式：node "pre_run.js"（由 SkillExecutorService 自动调用）
 *
 * 本脚本的 stdout 会被注入到发给 AI 的 userMessage 中（_preRunOutput）。
 * 退出码 0 = 成功，非 0 = 中止 Skill 执行。
 */

const startTime = Date.now();

console.log('========================================');
console.log('🧪 daily-digest-email pre_run 脚本启动');
console.log(`⏰ 执行时间: ${new Date().toISOString()}`);
console.log('========================================');

// 1. 打印所有 Skill 注入的环境变量
console.log('\n📦 注入的环境变量:');
const skillEnvKeys = [
  'SKILL_ID',
  'SKILL_NAME',
  'SKILL_DIR',
  'USER_ID',
  'SESSION_ID',
  'SKILL_PARAMS',
  'SKILL_SETTINGS',
];

for (const key of skillEnvKeys) {
  const value = process.env[key];
  if (value) {
    // 对 JSON 格式的值做格式化输出
    if (key === 'SKILL_PARAMS' || key === 'SKILL_SETTINGS') {
      try {
        const parsed = JSON.parse(value);
        console.log(`  ${key}: ${JSON.stringify(parsed, null, 2)}`);
      } catch {
        console.log(`  ${key}: ${value}`);
      }
    } else {
      console.log(`  ${key}: ${value}`);
    }
  } else {
    console.log(`  ${key}: ❌ 未设置`);
  }
}

// 2. 运行环境信息
console.log('\n🖥️  运行环境:');
console.log(`  Node 版本: ${process.version}`);
console.log(`  平台: ${process.platform} ${process.arch}`);
console.log(`  工作目录: ${process.cwd()}`);
console.log(`  PID: ${process.pid}`);

// 3. 模拟预处理输出（这段内容会被注入到 AI 的 userMessage 中）
console.log('\n📋 预处理结果:');
console.log('  脚本执行链路验证通过 ✅');
console.log(`  耗时: ${Date.now() - startTime}ms`);

// 退出码 0 表示成功，Skill 继续执行
process.exit(0);
