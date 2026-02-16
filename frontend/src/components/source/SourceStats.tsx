import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SourceStats as SourceStatsType } from "@/types";

interface SourceStatsProps {
  stats: SourceStatsType;
}

export function SourceStats({ stats }: SourceStatsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">数据源统计</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">总文章数</p>
            <p className="text-lg font-semibold">{stats.totalArticles}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">相关文章</p>
            <p className="text-lg font-semibold">{stats.relevantArticles}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">相关率</span>
            <span>{Math.round(stats.relevanceRate * 100)}%</span>
          </div>
          <Progress value={stats.relevanceRate * 100} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">平均分</span>
            <span>{Math.round(stats.averageScore)}/100</span>
          </div>
          <Progress value={stats.averageScore} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
