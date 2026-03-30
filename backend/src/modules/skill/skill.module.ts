import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillConfigEntity } from '../../common/database/entities/skill-config.entity.js';
import { SkillExecutionEntity } from '../../common/database/entities/skill-execution.entity.js';
import { SkillController } from './skill.controller.js';
import { SkillService } from './skill.service.js';
import { SkillParserService } from './skill-parser.service.js';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillExecutorService } from './skill-executor.service.js';
import { SkillPromptService } from './skill-prompt.service.js';
import { SkillEnhancerService } from './skill-enhancer.service.js';
import { AgentModule } from '../agent/agent.module.js';
import { UserModule } from '../user/user.module.js';

/**
 * Skill 模块
 *
 * 提供 Skill 的完整生命周期管理：
 * - SkillParserService:    解析 SKILL.md 文件
 * - SkillRegistryService:  发现、加载、注册、解析 Skill
 * - SkillPromptService:    Prompt 模板引擎（{{variable}} 插值）
 * - SkillExecutorService:  构建 AgentLoopConfig + 生命周期钩子（独立运行 Skill）
 * - SkillEnhancerService:  Skill 增强服务（将 Skill 注入到现有流程中）
 * - SkillService:          业务层（用户配置、执行记录）
 * - SkillController:       REST API 接口
 *
 * 依赖关系：
 * - AgentModule: 提供 AgentToolRegistry（工具筛选）和 AgentService（执行 AgentLoop）
 * - UserModule:  提供 UserService（获取用户信息填充 Prompt 变量）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SkillConfigEntity, SkillExecutionEntity]),
    forwardRef(() => AgentModule),
    UserModule,
  ],
  controllers: [SkillController],
  providers: [
    SkillService,
    SkillParserService,
    SkillRegistryService,
    SkillExecutorService,
    SkillPromptService,
    SkillEnhancerService,
  ],
  exports: [
    SkillService,
    SkillRegistryService,
    SkillExecutorService,
    SkillPromptService,
    SkillEnhancerService,
  ],
})
export class SkillModule {}
