import { useState } from "react";
import { Search, Loader2, Check, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { wechatApi } from "@/api/source";
import { useSourceStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";

interface SearchResult {
  fakeid: string;
  nickname: string;
  roundHeadImg?: string;
}

interface AddWechatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddWechatDialog({ open, onOpenChange }: AddWechatDialogProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const { toast } = useToast();
  const { createSource, sources } = useSourceStore();

  const addedFakeids = new Set(
    sources.filter((s) => s.type === "wechat").map((s) => s.identifier)
  );

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setHasSearched(true);

    try {
      const res = await wechatApi.search(q);
      const list: SearchResult[] = res.data || [];
      setSearchResults(list);
      if (list.length === 0) {
        toast({
          title: "未找到结果",
          description: `未搜索到与「${q}」匹配的公众号`,
          variant: "destructive",
        });
      }
    } catch (e: unknown) {
      const msg = (e as Error).message || "搜索失败";
      if (msg.includes("凭证") || msg.includes("Token") || msg.includes("401")) {
        toast({
          title: "微信凭证不可用",
          description: "请先在设置页面更新微信 Token/Cookie",
          variant: "destructive",
        });
      } else {
        toast({ title: "搜索失败", description: msg, variant: "destructive" });
      }
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (account: SearchResult) => {
    if (addedFakeids.has(account.fakeid)) {
      toast({
        title: "已存在",
        description: `「${account.nickname}」已在数据源中`,
        variant: "destructive",
      });
      return;
    }

    setAddingId(account.fakeid);
    try {
      await createSource({
        userId: DEFAULT_USER_ID,
        type: "wechat",
        identifier: account.fakeid,
        name: account.nickname,
      });
      toast({ title: "添加成功", description: `已添加「${account.nickname}」` });
      addedFakeids.add(account.fakeid);
    } catch (e: unknown) {
      toast({
        title: "添加失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setAddingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      // 关闭时重置状态
      setQuery("");
      setSearchResults([]);
      setHasSearched(false);
      setAddingId(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>添加微信公众号</DialogTitle>
          <DialogDescription>
            输入公众号名称搜索，点击添加关注
          </DialogDescription>
        </DialogHeader>

        {/* 搜索框 */}
        <div className="flex gap-2">
          <Input
            placeholder="输入公众号名称，如：机器之心、量子位..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button onClick={handleSearch} disabled={searching || !query.trim()}>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 搜索结果 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {searching && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              正在搜索...
            </div>
          )}

          {!searching && hasSearched && searchResults.length > 0 && (
            <div className="border rounded-lg divide-y">
              {searchResults.map((account) => {
                const isAdded = addedFakeids.has(account.fakeid);
                const isAdding = addingId === account.fakeid;

                return (
                  <div
                    key={account.fakeid}
                    className={`flex items-center gap-3 p-3 ${
                      isAdded ? "opacity-50" : ""
                    }`}
                  >
                    {/* 头像 */}
                    {account.roundHeadImg ? (
                      <img
                        src={account.roundHeadImg}
                        alt={account.nickname}
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {account.nickname}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {account.fakeid}
                      </p>
                    </div>

                    {/* 操作 */}
                    {isAdded ? (
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        已添加
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                        disabled={isAdding}
                        onClick={() => handleAdd(account)}
                      >
                        {isAdding ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            添加
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!searching && hasSearched && searchResults.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">未找到匹配的公众号</p>
              <p className="text-xs mt-1">请检查名称是否正确后重试</p>
            </div>
          )}

          {!hasSearched && (
            <div className="text-center py-10 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">输入名称开始搜索公众号</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
