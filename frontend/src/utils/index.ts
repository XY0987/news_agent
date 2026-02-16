/**
 * 日期格式化
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 评分颜色
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

/**
 * 评分背景色
 */
export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  if (score >= 40) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

/**
 * 源类型名称
 */
export function getSourceTypeName(type: string): string {
  const map: Record<string, string> = {
    wechat: "微信公众号",
    rss: "RSS 订阅",
    website: "网站",
    twitter: "Twitter",
  };
  return map[type] || type;
}

/**
 * 状态名称
 */
export function getStatusName(status: string): string {
  const map: Record<string, string> = {
    active: "正常",
    paused: "已暂停",
    error: "异常",
    pending: "待验证",
  };
  return map[status] || status;
}

/**
 * 状态颜色
 */
export function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    paused: "secondary",
    error: "destructive",
    pending: "outline",
  };
  return map[status] || "outline";
}

/**
 * 截取文本
 */
export function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

/**
 * 默认用户 ID（单用户模式）
 */
export const DEFAULT_USER_ID = "2a7f0e85-02fb-48ee-9c8b-7c76399598dc";
