import { Brain } from "lucide-react";

export function InsightsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Agent 洞察
        </h1>
        <p className="text-muted-foreground mt-1">
          查看 Agent 执行日志和智能建议
        </p>
      </div>
      <div className="text-center py-20 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg">暂无 Agent 洞察</p>
        <p className="text-sm mt-2">Agent 执行后将在此展示决策日志与建议</p>
      </div>
    </div>
  );
}
