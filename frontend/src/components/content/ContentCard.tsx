import { ExternalLink, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreIndicator } from "@/components/common/ScoreIndicator";
import { FeedbackButtons } from "./FeedbackButtons";
import { formatDate, getSourceTypeName } from "@/utils";
import type { Content } from "@/types";

interface ContentCardProps {
  content: Content;
  onFeedback: (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => void;
  currentFeedback?: string;
}

export function ContentCard({
  content,
  onFeedback,
  currentFeedback,
}: ContentCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-2">
              {content.title}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {getSourceTypeName(content.sourceType)}
              </Badge>
              <span>{content.sourceName}</span>
              {content.author && (
                <>
                  <span>·</span>
                  <span>{content.author}</span>
                </>
              )}
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(content.publishedAt)}
              </span>
            </div>
          </div>
          <ScoreIndicator
            score={content.score}
            breakdown={content.scoreBreakdown}
            size="md"
          />
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {content.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {content.summary}
          </p>
        )}

        {content.suggestions && content.suggestions.length > 0 && (
          <div className="mt-3 space-y-1">
            {content.suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs bg-muted/50 rounded-md p-2"
              >
                <Badge variant="secondary" className="text-xs shrink-0">
                  {s.type === "learn"
                    ? "学习"
                    : s.type === "practice"
                    ? "实践"
                    : "阅读"}
                </Badge>
                <span className="text-muted-foreground">{s.suggestion}</span>
              </div>
            ))}
          </div>
        )}

        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {content.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-0">
        <FeedbackButtons
          contentId={content.id}
          currentFeedback={currentFeedback}
          onFeedback={onFeedback}
        />
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-muted-foreground"
        >
          <a href={content.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            原文
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
