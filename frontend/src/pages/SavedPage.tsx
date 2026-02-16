import { useEffect, useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentDetail } from "@/components/content/ContentDetail";
import { feedbackApi, contentApi } from "@/api/content";
import { useContentStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";
import type { Content } from "@/types";

export function SavedPage() {
  const { submitFeedback } = useContentStore();
  const [savedContents, setSavedContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await feedbackApi.getHistory(DEFAULT_USER_ID, 90);
        const fbList = (res.data || []).filter(
          (f: any) => f.feedbackType === "save"
        );

        const contentIds = [
          ...new Set(fbList.map((f: any) => f.contentId)),
        ] as string[];
        const contentResults = await Promise.all(
          contentIds.slice(0, 50).map(async (id: string) => {
            try {
              const r = await contentApi.getById(id, DEFAULT_USER_ID);
              return r.data;
            } catch {
              return null;
            }
          })
        );
        setSavedContents(contentResults.filter(Boolean) as Content[]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleFeedback = (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => {
    submitFeedback(contentId, { contentId, type });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-primary" />
          我的收藏
        </h1>
        <p className="text-muted-foreground mt-1">你收藏的精选内容</p>
      </div>

      {savedContents.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无收藏</p>
          <p className="text-sm mt-2">在内容卡片上点击收藏按钮即可添加</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            共 {savedContents.length} 条收藏
          </p>
          {savedContents.map((content) => (
            <div
              key={content.id}
              className="cursor-pointer"
              onClick={() => setSelectedContent(content)}
            >
              <ContentCard
                content={content}
                onFeedback={handleFeedback}
                currentFeedback="save"
              />
            </div>
          ))}
        </div>
      )}

      <ContentDetail
        content={selectedContent}
        open={!!selectedContent}
        onClose={() => setSelectedContent(null)}
        onFeedback={handleFeedback}
      />
    </div>
  );
}
