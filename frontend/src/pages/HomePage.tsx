import { useEffect, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentCard } from "@/components/content/ContentCard";
import { useContentStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";

const HIGH_SCORE_THRESHOLD = 60;

export function HomePage() {
  const { digest, loading, error, fetchDigest, submitFeedback } =
    useContentStore();
  const [showLowScore, setShowLowScore] = useState(false);

  useEffect(() => {
    fetchDigest(DEFAULT_USER_ID);
  }, [fetchDigest]);

  const handleFeedback = (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => {
    submitFeedback(contentId, {
      contentId,
      type,
    });
  };

  const highScoreItems = digest.filter(
    (c) => c.score >= HIGH_SCORE_THRESHOLD
  );
  const lowScoreItems = digest.filter(
    (c) => c.score < HIGH_SCORE_THRESHOLD
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            今日精选
          </h1>
          <p className="text-muted-foreground mt-1">
            AI 智能筛选的高价值内容推荐
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDigest(DEFAULT_USER_ID)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          刷新
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {loading && digest.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>加载中...</p>
        </div>
      ) : digest.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Sparkles className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg mb-2">暂无今日精选</p>
          <p className="text-sm">
            请先添加数据源，等待 Agent 自动采集并生成推荐
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            共 {digest.length} 篇 · 精选推荐 {highScoreItems.length} 篇
            {lowScoreItems.length > 0 &&
              ` · 其他 ${lowScoreItems.length} 篇`}
          </p>

          {highScoreItems.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              onFeedback={handleFeedback}
            />
          ))}

          {lowScoreItems.length > 0 && (
            <div className="pt-2">
              <Button
                variant="ghost"
                className="w-full justify-between text-muted-foreground hover:text-foreground"
                onClick={() => setShowLowScore(!showLowScore)}
              >
                <span className="text-sm">
                  更多文章 ({lowScoreItems.length} 篇，评分 &lt;{" "}
                  {HIGH_SCORE_THRESHOLD})
                </span>
                {showLowScore ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              {showLowScore && (
                <div className="space-y-3 mt-3">
                  {lowScoreItems.map((content) => (
                    <ContentCard
                      key={content.id}
                      content={content}
                      onFeedback={handleFeedback}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
