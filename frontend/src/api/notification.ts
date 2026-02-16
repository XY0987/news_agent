import apiClient from "./client";

export const notificationApi = {
  getChannelStatus() {
    return apiClient.get("/notifications/channels/status").then((r) => r.data);
  },

  sendTestEmail(email: string) {
    return apiClient
      .post("/notifications/test/email", { email })
      .then((r) => r.data);
  },

  sendDigest(userId: string, contentIds: string[], agentNote?: string) {
    return apiClient
      .post("/notifications/send-digest", { userId, contentIds, agentNote })
      .then((r) => r.data);
  },
};

export const systemApi = {
  sync(userId: string, sourceIds?: string[]) {
    return apiClient
      .post("/system/sync", { userId, sourceIds })
      .then((r) => r.data);
  },
};
