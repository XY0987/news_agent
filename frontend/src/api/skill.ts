import apiClient from "./client";
import type { Skill, SkillDetail, SkillExecution, SkillRegistryStats } from "@/types";

export const skillApi = {
  /** 获取 Skill 列表 */
  getAll(userId: string, params?: { category?: string; tags?: string }) {
    return apiClient
      .get<{ data: Skill[]; total: number }>("/skills", {
        params: { userId, ...params },
      })
      .then((r) => r.data);
  },

  /** 获取 Skill 详情 */
  getDetail(skillId: string, userId: string) {
    return apiClient
      .get<{ data: SkillDetail }>(`/skills/${skillId}`, {
        params: { userId },
      })
      .then((r) => r.data);
  },

  /** 获取注册表统计 */
  getStats() {
    return apiClient
      .get<{ data: SkillRegistryStats }>("/skills/stats")
      .then((r) => r.data);
  },

  /** 启用 Skill */
  enable(skillId: string, userId: string, settings?: Record<string, any>) {
    return apiClient
      .post(`/skills/${skillId}/enable`, { userId, settings })
      .then((r) => r.data);
  },

  /** 禁用 Skill */
  disable(skillId: string, userId: string) {
    return apiClient
      .post(`/skills/${skillId}/disable`, { userId })
      .then((r) => r.data);
  },

  /** 更新 Skill 设置 */
  updateSettings(
    skillId: string,
    userId: string,
    settings: Record<string, any>
  ) {
    return apiClient
      .put(`/skills/${skillId}/settings`, { userId, settings })
      .then((r) => r.data);
  },

  /** 手动执行 Skill */
  run(skillId: string, userId: string, params?: Record<string, any>) {
    return apiClient
      .post(
        `/skills/${skillId}/run`,
        { userId, params },
        { timeout: 300000 }
      )
      .then((r) => r.data);
  },

  /** 热重载 Skill */
  reload(skillId?: string) {
    return apiClient
      .post("/skills/reload", { skillId })
      .then((r) => r.data);
  },

  /** 获取执行记录 */
  getExecutions(
    userId: string,
    skillId?: string,
    limit?: number
  ) {
    return apiClient
      .get<{ data: SkillExecution[]; total: number }>("/skills/executions", {
        params: { userId, skillId, limit },
      })
      .then((r) => r.data);
  },

  /** 获取执行详情 */
  getExecutionDetail(executionId: string) {
    return apiClient
      .get(`/skills/executions/${executionId}`)
      .then((r) => r.data);
  },
};
