import { useEffect, useState, useMemo } from "react";
import {
  FolderOpen,
  Loader2,
  Plus,
  MessageSquare,
  Rss,
  Github,
  Search,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  Trash2,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SourceCard } from "@/components/source/SourceCard";
import { AddWechatDialog } from "@/components/source/AddWechatDialog";
import { useSourceStore } from "@/store";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_USER_ID } from "@/utils";
import type { Source } from "@/types";

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

function SourceCompactRow({
  source,
  onPause,
  onResume,
  onDelete,
}: {
  source: Source;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isPaused = source.status === "paused";
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 group transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="font-medium text-sm truncate">{source.name}</span>
        <Badge
          variant={isPaused ? "secondary" : source.status === "error" ? "destructive" : "outline"}
          className="text-xs shrink-0"
        >
          {isPaused ? "已暂停" : source.status === "error" ? "异常" : "活跃"}
        </Badge>
        {source.qualityScore > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {Math.round(source.qualityScore)}分
          </span>
        )}
        {source.stats?.totalArticles > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {source.stats.totalArticles}篇
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {isPaused ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onResume(source.id)}
            title="恢复"
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPause(source.id)}
            title="暂停"
          >
            <Pause className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDelete(source.id)}
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SourcesPage() {
  const { sources, loading, error, fetchSources, updateSource, deleteSource } =
    useSourceStore();
  const { toast } = useToast();
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    fetchSources(DEFAULT_USER_ID);
  }, [fetchSources]);

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return sources;
    const q = searchQuery.toLowerCase();
    return sources.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.identifier.toLowerCase().includes(q)
    );
  }, [sources, searchQuery]);

  const groupedSources = useMemo(() => {
    const groups: Record<string, Source[]> = {};
    for (const source of filteredSources) {
      const type = source.type || "other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(source);
    }
    return groups;
  }, [filteredSources]);

  const sourceTypes = useMemo(() => {
    const types = new Set(["wechat", ...Object.keys(groupedSources)]);
    return Array.from(types);
  }, [groupedSources]);

  const toggleCollapse = (type: string) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            数据源管理
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            共 {sources.length} 个订阅源
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索数据源名称..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
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
        <div className="space-y-3">
          {sourceTypes.map((type) => {
            const config = SOURCE_TYPE_CONFIG[type] ?? {
              label: type,
              icon: <FolderOpen className="h-4 w-4" />,
              color: "text-foreground",
            };
            const typeSources = groupedSources[type] || [];
            const isCollapsed = collapsedTypes.has(type);

            return (
              <Card key={type}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      onClick={() => toggleCollapse(type)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className={config.color}>{config.icon}</span>
                        {config.label}
                        <Badge variant="secondary" className="text-xs font-normal">
                          {typeSources.length}
                        </Badge>
                      </CardTitle>
                    </button>
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
                {!isCollapsed && (
                  <CardContent className="pt-0 px-4 pb-3">
                    {typeSources.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        {type === "wechat" ? (
                          <p>暂无公众号，点击上方按钮搜索添加</p>
                        ) : (
                          <p>暂无 {config.label} 数据源</p>
                        )}
                      </div>
                    ) : viewMode === "grid" ? (
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                    ) : (
                      <div className="divide-y">
                        {typeSources.map((source) => (
                          <SourceCompactRow
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
                )}
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
