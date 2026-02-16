import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourceList } from "@/components/source/SourceList";
import { useSourceStore } from "@/store";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_USER_ID } from "@/utils";

export function SourcesPage() {
  const navigate = useNavigate();
  const { sources, loading, error, fetchSources, updateSource, deleteSource } =
    useSourceStore();
  const { toast } = useToast();

  useEffect(() => {
    fetchSources(DEFAULT_USER_ID);
  }, [fetchSources]);

  const handlePause = async (id: string) => {
    try {
      await updateSource(id, { status: "paused" });
      toast({ title: "已暂停数据源" });
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    }
  };

  const handleResume = async (id: string) => {
    try {
      await updateSource(id, { status: "active" });
      toast({ title: "已恢复数据源" });
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该数据源吗？")) return;
    try {
      await deleteSource(id);
      toast({ title: "已删除数据源" });
    } catch {
      toast({ title: "删除失败", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            数据源管理
          </h1>
          <p className="text-muted-foreground mt-1">
            管理你的信息订阅源
          </p>
        </div>
        <Button onClick={() => navigate("/sources/add")}>
          <Plus className="h-4 w-4 mr-1" />
          添加数据源
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SourceList
          sources={sources}
          onPause={handlePause}
          onResume={handleResume}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
