import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import type { Suggestion } from "@/types";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: SuggestionCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              {suggestion.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              置信度: {Math.round(suggestion.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm">{suggestion.content}</p>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600"
            onClick={() => onAccept?.(suggestion.id)}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500"
            onClick={() => onReject?.(suggestion.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
