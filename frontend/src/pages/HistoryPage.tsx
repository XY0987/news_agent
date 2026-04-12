import { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentDetail } from "@/components/content/ContentDetail";
import { feedbackApi, contentApi } from "@/api/content";
import { useContentStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";
import type { Content } from "@/types";

export function HistoryPage() {
  const { submitFeedback } = useContentStore();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await feedbackApi.getHistory(DEFAULT_USER_ID, 30);
        const fbList = res.data || [];
        setFeedbacks(fbList);

        // 获取对应的内容详情
        const contentIds = [
          ...new Set(fbList.map((f: any) => f.contentId)),
        ] as string[];
        const contentResults = await Promise.all(
          contentIds.slice(0, 20).map(async (id: string) => {
            try {
              const r = await contentApi.getById(id, DEFAULT_USER_ID);
              return r.data;
            } catch {
              return null;
            }
          })
        );
        setContents(contentResults.filter(Boolean) as Content[]);
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

  const getFeedbackType = (contentId: string) => {
    const fb = feedbacks.find((f: any) => f.contentId === contentId);
    return fb?.feedbackType;
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
          <BookOpen className="h-6 w-6 text-primary" />
          阅读历史
        </h1>
        <p className="text-muted-foreground mt-1">
          你最近 30 天的阅读和反馈记录
        </p>
      </div>

      {contents.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无阅读历史</p>
          <p className="text-sm mt-2">
            对内容进行反馈后会自动记录到这里
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            共 {contents.length} 条记录
          </p>
          {contents.map((content) => (
            <div
              key={content.id}
              className="cursor-pointer"
              onClick={() => setSelectedContent(content)}
            >
              <ContentCard
                content={content}
                onFeedback={handleFeedback}
                currentFeedback={getFeedbackType(content.id)}
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
