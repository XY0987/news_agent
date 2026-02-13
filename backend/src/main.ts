import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用 CORS（前端跨域访问）
  app.enableCors();

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`🚀 News Agent API running on http://localhost:${port}`);
}
bootstrap();
