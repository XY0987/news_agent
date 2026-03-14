import { useState } from "react";
import { Loader2, Check, Plus, Star, TrendingUp, Globe, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSourceStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";

interface GithubPreset {
  identifier: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  tags: string[];
}

const GITHUB_PRESETS: GithubPreset[] = [
  {
    identifier: "all",
    name: "全部 GitHub 热点",
    description: "聚合所有 GitHub 热点来源，包括 Trending、最受欢迎仓库和前端热点",
    icon: <Layers className="h-5 w-5" />,
    tags: ["推荐", "全部来源"],
  },
  {
    identifier: "trending-monthly",
    name: "GitHub Trending（月榜）",
    description: "GitHub 官方月度 Star 趋势榜单，发现最近一月最热门的开源项目",
    icon: <TrendingUp className="h-5 w-5" />,
    tags: ["官方", "月榜"],
  },
  {
    identifier: "trending-weekly",
    name: "GitHub Trending（周榜）",
    description: "GitHub 官方每周 Star 趋势榜单，追踪每周热门开源项目动态",
    icon: <TrendingUp className="h-5 w-5" />,
    tags: ["官方", "周榜"],
  },
  {
    identifier: "trending-daily",
    name: "GitHub Trending（日榜）",
    description: "GitHub 官方每日 Star 趋势榜单，第一时间发现新兴热门项目",
    icon: <TrendingUp className="h-5 w-5" />,
    tags: ["官方", "日榜"],
  },
  {
    identifier: "trending-repos-api",
    name: "最受欢迎仓库",
    description: "通过第三方 API 获取每日最受欢迎的 GitHub 仓库，数据更全面",
    icon: <Star className="h-5 w-5" />,
    tags: ["第三方", "每日"],
  },
  {
    identifier: "topics-frontend",
    name: "前端热点话题",
    description: "GitHub 前端相关话题下的热门仓库，聚焦前端技术栈",
    icon: <Globe className="h-5 w-5" />,
    tags: ["前端", "话题"],
  },
];

interface AddGithubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddGithubDialog({ open, onOpenChange }: AddGithubDialogProps) {
  const [addingId, setAddingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { createSource, sources } = useSourceStore();

  const addedIdentifiers = new Set(
    sources.filter((s) => s.type === "github").map((s) => s.identifier)
  );

  const handleAdd = async (preset: GithubPreset) => {
    if (addedIdentifiers.has(preset.identifier)) {
      toast({
        title: "已存在",
        description: `「${preset.name}」已在数据源中`,
        variant: "destructive",
      });
      return;
    }

    setAddingId(preset.identifier);
    try {
      await createSource({
        userId: DEFAULT_USER_ID,
        type: "github",
        identifier: preset.identifier,
        name: preset.name,
      });
      toast({ title: "添加成功", description: `已添加「${preset.name}」` });
      addedIdentifiers.add(preset.identifier);
    } catch (e: unknown) {
      toast({
        title: "添加失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>添加 GitHub 数据源</DialogTitle>
          <DialogDescription>
            选择你感兴趣的 GitHub 热点来源，系统会每天自动采集并推送个性化建议
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {GITHUB_PRESETS.map((preset) => {
            const isAdded = addedIdentifiers.has(preset.identifier);
            const isAdding = addingId === preset.identifier;

            return (
              <div
                key={preset.identifier}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  isAdded
                    ? "opacity-50 bg-muted/30"
                    : "hover:bg-muted/50 cursor-pointer"
                }`}
              >
                {/* 图标 */}
                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-gray-700 dark:text-gray-300">
                  {preset.icon}
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm">{preset.name}</p>
                    {preset.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={tag === "推荐" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                {/* 操作 */}
                <div className="flex-shrink-0 pt-1">
                  {isAdded ? (
                    <Badge variant="secondary" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      已添加
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAdding}
                      onClick={() => handleAdd(preset)}
                    >
                      {isAdding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          添加
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            💡 推荐选择「全部 GitHub 热点」以获取最全面的技术资讯
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
