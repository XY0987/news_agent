import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { sourceApi, wechatApi } from "@/api/source";
import { useSourceStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";

export function SourceForm() {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createSource } = useSourceStore();

  const handleValidate = async () => {
    if (!identifier.trim()) {
      toast({ title: "请输入公众号 Fakeid", variant: "destructive" });
      return;
    }
    setValidating(true);
    try {
      await sourceApi.validate({ type: "wechat", identifier: identifier.trim() });
      setValidated(true);
      toast({ title: "验证通过", description: "公众号身份验证成功" });
    } catch (e: unknown) {
      toast({
        title: "验证失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSearch = async () => {
    if (!name.trim()) return;
    try {
      const res = await wechatApi.search(name.trim());
      if (res.data && res.data.length > 0) {
        const first = res.data[0];
        setIdentifier(first.fakeid || first.identifier || "");
        setName(first.nickname || first.name || name);
        toast({ title: "找到公众号", description: first.nickname || first.name });
      } else {
        toast({
          title: "未找到",
          description: "未搜索到匹配的公众号",
          variant: "destructive",
        });
      }
    } catch {
      // 搜索接口可选，静默失败
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !identifier.trim()) {
      toast({ title: "请填写完整信息", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await createSource({
        userId: DEFAULT_USER_ID,
        type: "wechat",
        identifier: identifier.trim(),
        name: name.trim(),
      });
      toast({ title: "添加成功", description: `已添加「${name}」` });
      navigate("/sources");
    } catch (e: unknown) {
      toast({
        title: "添加失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>添加微信公众号</CardTitle>
        <CardDescription>
          输入公众号名称搜索或直接填写 Fakeid
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">公众号名称</Label>
          <div className="flex gap-2">
            <Input
              id="name"
              placeholder="例如：机器之心"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleSearch}
              title="搜索公众号"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="identifier">Fakeid</Label>
          <div className="flex gap-2">
            <Input
              id="identifier"
              placeholder="公众号 Fakeid"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setValidated(false);
              }}
            />
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={validating || !identifier.trim()}
            >
              {validating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              验证
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fakeid 可通过微信公众号后台获取
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !identifier.trim()}
            className="flex-1"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {validated ? "添加数据源" : "直接添加"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/sources")}>
            取消
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
