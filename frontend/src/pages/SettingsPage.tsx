import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Play,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { agentApi } from "@/api/agent";
import { systemApi } from "@/api/notification";
import { wechatApi } from "@/api/source";
import { DEFAULT_USER_ID } from "@/utils";

interface CredentialStatus {
  hasCredentials: boolean;
  source?: "env" | "api";
  expiresAt?: string;
  remainingDays?: number;
}

export function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [token, setToken] = useState("");
  const [cookie, setCookie] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [credStatus, setCredStatus] = useState<CredentialStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await wechatApi.getCredentialsStatus();
      setCredStatus(res.data ?? res);
    } catch {
      setCredStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await systemApi.sync(DEFAULT_USER_ID);
      toast({ title: "采集完成", description: "已触发数据采集" });
    } catch (e: unknown) {
      toast({
        title: "采集失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      await agentApi.run(DEFAULT_USER_ID);
      toast({ title: "Agent 执行完成" });
    } catch (e: unknown) {
      toast({
        title: "Agent 执行失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRunningAgent(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!token.trim() || !cookie.trim()) {
      toast({
        title: "请填写完整",
        description: "Token 和 Cookie 不能为空",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await wechatApi.updateCredentials(token.trim(), cookie.trim());
      toast({ title: "凭证已更新", description: "微信 Token 和 Cookie 已保存到 Redis" });
      setToken("");
      setCookie("");
      fetchStatus();
    } catch (e: unknown) {
      toast({
        title: "更新失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          系统设置
        </h1>
        <p className="text-muted-foreground mt-1">系统控制与调试</p>
      </div>

      {/* 微信凭证管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                微信公众号凭证
              </CardTitle>
              <CardDescription className="mt-1">
                更新微信公众号后台的 Token 和 Cookie，用于采集公众号文章
              </CardDescription>
            </div>
            {!loadingStatus && credStatus && (
              <Badge
                variant={credStatus.hasCredentials ? "default" : "destructive"}
                className="shrink-0"
              >
                {credStatus.hasCredentials ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <AlertTriangle className="h-3 w-3 mr-1" />
                )}
                {credStatus.hasCredentials
                  ? `有效 (${credStatus.source === "api" ? "手动更新" : "环境变量"}${
                      credStatus.remainingDays != null
                        ? ` · 剩余 ${credStatus.remainingDays} 天`
                        : ""
                    })`
                  : "未配置"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wechat-token">Token</Label>
            <Input
              id="wechat-token"
              placeholder="从微信公众号后台获取的 token 值"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              登录 mp.weixin.qq.com → 打开 DevTools → Network → 找到任意请求中的 token 参数
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="wechat-cookie">Cookie</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowCookie(!showCookie)}
              >
                {showCookie ? (
                  <EyeOff className="h-3 w-3 mr-1" />
                ) : (
                  <Eye className="h-3 w-3 mr-1" />
                )}
                {showCookie ? "隐藏" : "显示"}
              </Button>
            </div>
            {showCookie ? (
              <Textarea
                id="wechat-cookie"
                placeholder="从浏览器 DevTools 复制完整的 Cookie 字符串"
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
            ) : (
              <Input
                id="wechat-cookie"
                type="password"
                placeholder="从浏览器 DevTools 复制完整的 Cookie 字符串"
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              DevTools → Application → Cookies → mp.weixin.qq.com，或从请求 Headers 中复制
            </p>
          </div>
          <Button
            onClick={handleSaveCredentials}
            disabled={saving || !token.trim() || !cookie.trim()}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存凭证
          </Button>
        </CardContent>
      </Card>

      {/* 手动操作 */}
      <Card>
        <CardHeader>
          <CardTitle>手动操作</CardTitle>
          <CardDescription>调试和手动触发系统任务</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">触发数据采集</p>
              <p className="text-xs text-muted-foreground">
                手动采集所有已配置数据源的最新内容
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              采集
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">运行 Agent</p>
              <p className="text-xs text-muted-foreground">
                手动触发 Agent 执行完整推荐流程
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunAgent}
              disabled={runningAgent}
            >
              {runningAgent ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              执行
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
