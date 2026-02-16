import { useEffect, useState } from "react";
import { Rss, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ContentCard } from "@/components/content/ContentCard";
import { useContentStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";

export function FeedPage() {
  const { contents, total, page, loading, fetchContents, submitFeedback } =
    useContentStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchContents({ userId: DEFAULT_USER_ID, page: 1, pageSize: 20 });
  }, [fetchContents]);

  const handleFeedback = (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => {
    submitFeedback(contentId, { contentId, type });
  };

  const handleLoadMore = () => {
    fetchContents({ userId: DEFAULT_USER_ID, page: page + 1, pageSize: 20 });
  };

  const filtered = search
    ? contents.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.sourceName.toLowerCase().includes(search.toLowerCase())
      )
    : contents;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rss className="h-6 w-6 text-primary" />
          信息流
        </h1>
        <p className="text-muted-foreground mt-1">所有采集到的内容</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="搜索标题、来源..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && contents.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Rss className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无内容</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            共 {total} 条内容
          </p>
          {filtered.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              onFeedback={handleFeedback}
            />
          ))}
          {contents.length < total && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                加载更多
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
