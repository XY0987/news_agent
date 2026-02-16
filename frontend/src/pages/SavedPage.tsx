import { Bookmark } from "lucide-react";

export function SavedPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-primary" />
          我的收藏
        </h1>
        <p className="text-muted-foreground mt-1">你收藏的精选内容</p>
      </div>
      <div className="text-center py-20 text-muted-foreground">
        <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg">暂无收藏</p>
        <p className="text-sm mt-2">在内容卡片上点击收藏按钮即可添加</p>
      </div>
    </div>
  );
}
