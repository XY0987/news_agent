/**
 * 应用配置
 * 使用 @nestjs/config 管理环境变量
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '8000', 10),

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '3306', 10),
    username: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'password',
    name: process.env.DATABASE_NAME || 'news_agent',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  llm: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  },

  collector: {
    githubToken: process.env.GITHUB_TOKEN || '',
    werssApiKey: process.env.WERSS_API_KEY || '',
  },

  notification: {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
    },
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  },
});
