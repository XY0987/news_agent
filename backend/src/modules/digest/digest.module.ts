import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DigestService } from './digest.service';
import { DigestEntity } from '../../common/database/entities/digest.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DigestEntity])],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
