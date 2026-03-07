import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ScoreBreakdown } from "@/types";
import { getScoreBgColor } from "@/utils";

interface ScoreIndicatorProps {
  score: number;
  breakdown?: ScoreBreakdown;
  size?: "sm" | "md" | "lg";
  showBreakdown?: boolean;
}

const dimensionLabels: Record<string, string> = {
  relevance: "相关性",
  quality: "质量",
  timeliness: "时效性",
  novelty: "新颖度",
  actionability: "可操作性",
};

const dimensionWeights: Record<string, number> = {
  relevance: 0.45,
  quality: 0.20,
  timeliness: 0.20,
  novelty: 0.10,
  actionability: 0.05,
};

function ScoreBadge({ score, size = "md" }: { score: number; size?: string }) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-0.5",
    lg: "text-base px-3 py-1",
  };
  return (
    <span
      className={cn(
        "font-semibold rounded-md inline-flex items-center",
        getScoreBgColor(score),
        sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md
      )}
    >
      {score != null ? Math.round(score) : '-'}
    </span>
  );
}

function BreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="space-y-2 min-w-[200px]">
      <p className="text-xs font-medium mb-2">评分明细</p>
      {Object.entries(breakdown).map(([key, value]) => (
        <div key={key} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span>{dimensionLabels[key] || key}</span>
            <span className="text-muted-foreground">
              {Math.round(value)} × {dimensionWeights[key] || 0}
            </span>
          </div>
          <Progress value={value} className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

export function ScoreIndicator({
  score,
  breakdown,
  size = "md",
  showBreakdown = true,
}: ScoreIndicatorProps) {
  if (!showBreakdown || !breakdown) {
    return <ScoreBadge score={score} size={size} />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            <ScoreBadge score={score} size={size} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3">
          <BreakdownPanel breakdown={breakdown} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
