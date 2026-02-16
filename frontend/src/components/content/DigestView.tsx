import type { Content } from "@/types";
import { ContentCard } from "./ContentCard";
import { Separator } from "@/components/ui/separator";

interface DigestViewProps {
  date: string;
  contents: Content[];
  onFeedback: (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => void;
}

export function DigestView({ date, contents, onFeedback }: DigestViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">{date}</h3>
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {contents.length} 条精选
        </span>
      </div>
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
