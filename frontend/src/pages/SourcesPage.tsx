import { useEffect, useState, useMemo } from "react";
import { FolderOpen, Loader2, Plus, MessageSquare, Rss, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceCard } from "@/components/source/SourceCard";
import { AddWechatDialog } from "@/components/source/AddWechatDialog";
import { useSourceStore } from "@/store";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_USER_ID } from "@/utils";

const SOURCE_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  wechat: {
    label: "微信公众号",
    icon: <MessageSquare className="h-4 w-4" />,
    color: "text-green-600",
  },
  rss: {
    label: "RSS 订阅",
    icon: <Rss className="h-4 w-4" />,
    color: "text-orange-500",
  },
  github: {
    label: "GitHub",
    icon: <Github className="h-4 w-4" />,
    color: "text-gray-700",
  },
};

export function SourcesPage() {
  const { sources, loading, error, fetchSources, updateSource, deleteSource } =
    useSourceStore();
  const { toast } = useToast();
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);

  useEffect(() => {
    fetchSources(DEFAULT_USER_ID);
  }, [fetchSources]);

  // 按类型分组
  const groupedSources = useMemo(() => {
    const groups: Record<string, typeof sources> = {};
    for (const source of sources) {
      const type = source.type || "other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(source);
    }
    return groups;
  }, [sources]);

  // 确保 wechat 分组始终显示
  const sourceTypes = useMemo(() => {
    const types = new Set(["wechat", ...Object.keys(groupedSources)]);
    return Array.from(types);
  }, [groupedSources]);

  const handlePause = async (id: string) => {
    try {
      await updateSource(id, { status: "paused" });
      toast({ title: "已暂停数据源" });
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    }
  };

  const handleResume = async (id: string) => {
    try {
      await updateSource(id, { status: "active" });
      toast({ title: "已恢复数据源" });
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该数据源吗？")) return;
    try {
      await deleteSource(id);
      toast({ title: "已删除数据源" });
    } catch {
      toast({ title: "删除失败", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          数据源管理
        </h1>
        <p className="text-muted-foreground mt-1">管理你的信息订阅源</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {sourceTypes.map((type) => {
            const config = SOURCE_TYPE_CONFIG[type] ?? {
              label: type,
              icon: <FolderOpen className="h-4 w-4" />,
              color: "text-foreground",
            };
            const typeSources = groupedSources[type] || [];

            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      {config.label}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({typeSources.length})
                      </span>
                    </CardTitle>
                    {type === "wechat" && (
                      <Button
                        size="sm"
                        onClick={() => setWechatDialogOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        添加公众号
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {typeSources.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {type === "wechat" ? (
                        <p>
                          暂无公众号，点击上方按钮搜索添加
                        </p>
                      ) : (
                        <p>暂无 {config.label} 数据源</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {typeSources.map((source) => (
                        <SourceCard
                          key={source.id}
                          source={source}
                          onPause={handlePause}
                          onResume={handleResume}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddWechatDialog
        open={wechatDialogOpen}
        onOpenChange={setWechatDialogOpen}
      />
    </div>
  );
}
