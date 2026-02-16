import { SourceCard } from "./SourceCard";
import type { Source } from "@/types";

interface SourceListProps {
  sources: Source[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function SourceList({
  sources,
  onPause,
  onResume,
  onDelete,
}: SourceListProps) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">暂无数据源</p>
        <p className="text-sm">点击上方按钮添加你的第一个数据源</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sources.map((source) => (
        <SourceCard
          key={source.id}
          source={source}
          onPause={onPause}
          onResume={onResume}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
