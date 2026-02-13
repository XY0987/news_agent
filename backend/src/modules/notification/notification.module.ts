import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { EmailChannel } from './channels/email.channel';
import { TelegramChannel } from './channels/telegram.channel';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, EmailChannel, TelegramChannel],
  exports: [NotificationService],
})
export class NotificationModule {}
