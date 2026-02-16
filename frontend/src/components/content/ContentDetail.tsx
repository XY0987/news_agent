import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreIndicator } from "@/components/common/ScoreIndicator";
import { FeedbackButtons } from "./FeedbackButtons";
import { formatDate, getSourceTypeName } from "@/utils";
import type { Content } from "@/types";

interface ContentDetailProps {
  content: Content | null;
  open: boolean;
  onClose: () => void;
  onFeedback: (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => void;
}

export function ContentDetail({
  content,
  open,
  onClose,
  onFeedback,
}: ContentDetailProps) {
  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg leading-tight">
            {content.title}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
            <Badge variant="outline">{getSourceTypeName(content.sourceType)}</Badge>
            <span>{content.sourceName}</span>
            {content.author && (
              <>
                <span>·</span>
                <span>{content.author}</span>
              </>
            )}
            <span>·</span>
            <span>{formatDate(content.publishedAt)}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <ScoreIndicator
              score={content.score}
              breakdown={content.scoreBreakdown}
              showBreakdown
            />
            {content.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {content.summary && (
            <div>
              <h4 className="font-medium text-sm mb-1">AI 摘要</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {content.summary}
              </p>
            </div>
          )}

          {content.suggestions && content.suggestions.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">行动建议</h4>
              <div className="space-y-2">
                {content.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 bg-muted/50 rounded-md p-2"
                  >
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {s.type === "learn"
                        ? "学习"
                        : s.type === "practice"
                        ? "实践"
                        : "阅读"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {s.suggestion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <FeedbackButtons contentId={content.id} onFeedback={onFeedback} />
            <Button variant="outline" size="sm" asChild>
              <a href={content.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                阅读原文
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
