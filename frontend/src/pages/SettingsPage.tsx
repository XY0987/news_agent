import { useState } from "react";
import { Settings, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { agentApi } from "@/api/agent";
import { systemApi } from "@/api/notification";
import { DEFAULT_USER_ID } from "@/utils";

export function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const { toast } = useToast();

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          系统设置
        </h1>
        <p className="text-muted-foreground mt-1">系统控制与调试</p>
      </div>

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
