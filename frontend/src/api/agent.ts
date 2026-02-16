import apiClient from "./client";

export const agentApi = {
  run(userId: string) {
    return apiClient.post("/agent/run", { userId }).then((r) => r.data);
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
