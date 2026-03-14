import apiClient from "./client";

export const agentApi = {
  run(userId: string) {
    return apiClient.post("/agent/run", { userId }).then((r) => r.data);
  },

  /** 触发 GitHub 热点 Agent（LLM 自主决策：采集 + 分析 + 推送） */
  runGithub(userId: string) {
    return apiClient
      .post("/agent/run-github", { userId }, { timeout: 300000 })
      .then((r) => r.data);
  },

  analyze(userId: string, daysWindow?: number) {
    return apiClient
      .post("/agent/analyze", { userId, daysWindow })
      .then((r) => r.data);
  },

  getLogs(userId: string, limit?: number) {
    return apiClient
      .get("/agent/logs", { params: { userId, limit } })
      .then((r) => r.data);
  },

  getSessionDetail(sessionId: string) {
    return apiClient.get(`/agent/logs/${sessionId}`).then((r) => r.data);
  },

  getSessions(userId: string, limit?: number) {
    return apiClient
      .get("/agent/sessions", { params: { userId, limit } })
      .then((r) => r.data);
  },
};
