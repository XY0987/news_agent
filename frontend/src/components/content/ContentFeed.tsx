import { ContentCard } from "./ContentCard";
import type { Content } from "@/types";

interface ContentFeedProps {
  contents: Content[];
  onFeedback: (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => void;
}

export function ContentFeed({ contents, onFeedback }: ContentFeedProps) {
  if (contents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        暂无内容
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contents.map((content) => (
        <ContentCard
          key={content.id}
          content={content}
          onFeedback={onFeedback}
        />
      ))}
    </div>
  );
}
