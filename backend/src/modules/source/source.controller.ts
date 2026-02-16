import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SourceService } from './source.service';
import {
  CreateSourceDto,
  UpdateSourceDto,
  ValidateSourceDto,
} from './dto/index';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('api/sources')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @Post()
  async create(@Body() dto: CreateSourceDto) {
    const source = await this.sourceService.create(dto);
    return ApiResponse.ok(source, 'Source created');
  }

  @Get()
  async findAll(@Query('userId') userId?: string) {
    const sources = await this.sourceService.findAll(userId);
    return ApiResponse.ok(sources);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const source = await this.sourceService.findById(id);
    return ApiResponse.ok(source);
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    const stats = await this.sourceService.getStats(id);
    return ApiResponse.ok(stats);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSourceDto) {
    const source = await this.sourceService.update(id, dto);
    return ApiResponse.ok(source, 'Source updated');
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.sourceService.delete(id);
    return ApiResponse.ok(null, 'Source deleted');
  }

  @Post('validate')
  async validate(@Body() dto: ValidateSourceDto) {
    const result = await this.sourceService.validate(dto);
    return ApiResponse.ok(result);
  }
}
