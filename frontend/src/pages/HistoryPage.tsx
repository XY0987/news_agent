import { BookOpen } from "lucide-react";

export function HistoryPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          阅读历史
        </h1>
        <p className="text-muted-foreground mt-1">查看你的阅读记录</p>
      </div>
      <div className="text-center py-20 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg">暂无阅读历史</p>
        <p className="text-sm mt-2">阅读历史功能将在下一版本中实现</p>
      </div>
    </div>
  );
}
