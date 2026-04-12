import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用 CORS（前端跨域访问）
  app.enableCors();

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局日志拦截器
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`🚀 News Agent API running on http://localhost:${port}`);
}
void bootstrap();
