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
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  llm: {
    url: process.env.LLM_URL || 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o',
    fallbackModel: process.env.LLM_FALLBACK_MODEL || '',
  },

  alert: {
    email: process.env.ALERT_EMAIL || '',
  },

  collector: {
    githubToken: process.env.GITHUB_TOKEN || '',
    werssApiKey: process.env.WERSS_API_KEY || '',
    wechat: {
      token: process.env.WECHAT_TOKEN || '',
      cookie: process.env.WECHAT_COOKIE || '',
      apiUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsgpublish',
      searchApiUrl: 'https://mp.weixin.qq.com/cgi-bin/searchbiz',
      rateLimit: {
        minDelay: 3000,
        maxDelay: 5000,
      },
      articleFetchDelay: {
        minDelay: 250,
        maxDelay: 600,
      },
      maxRetry: 3,
      timeout: 30000,
      tokenTtlDays: 7,
      maxAgeDays: parseInt(process.env.WECHAT_MAX_AGE_DAYS ?? '7', 10),
    },
  },

  notification: {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT ?? '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
      from: process.env.SMTP_FROM || '',
    },
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  },
});
