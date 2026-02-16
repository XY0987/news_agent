import {
  BarChart3,
  AlertCircle,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getSourceTypeName,
  getStatusName,
  getStatusVariant,
} from "@/utils";
import type { Source } from "@/types";

interface SourceCardProps {
  source: Source;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function SourceCard({
  source,
  onPause,
  onResume,
  onDelete,
}: SourceCardProps) {
  const isPaused = source.status === "paused";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{source.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {getSourceTypeName(source.type)}
              </Badge>
              <Badge variant={getStatusVariant(source.status)} className="text-xs">
                {getStatusName(source.status)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isPaused ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onResume?.(source.id)}
              >
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPause?.(source.id)}
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete?.(source.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              质量评分
            </span>
            <span className="font-medium">
              {Math.round(source.qualityScore)}/100
            </span>
          </div>
          <Progress value={source.qualityScore} className="h-2" />

          {source.stats && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-muted-foreground text-xs">总文章数</p>
                <p className="font-medium">{source.stats.totalArticles}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-muted-foreground text-xs">相关文章</p>
                <p className="font-medium">{source.stats.relevantArticles}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-muted-foreground text-xs">相关率</p>
                <p className="font-medium">
                  {Math.round(source.stats.relevanceRate * 100)}%
                </p>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-muted-foreground text-xs">平均分</p>
                <p className="font-medium">
                  {Math.round(source.stats.averageScore)}
                </p>
              </div>
            </div>
          )}

          {source.status === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
              <AlertCircle className="h-4 w-4" />
              <span>数据源异常，请检查配置</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            ID: {source.identifier}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
