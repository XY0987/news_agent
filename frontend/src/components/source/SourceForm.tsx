import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
import { useSourceStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";

export function SourceForm() {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createSource } = useSourceStore();

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
        <CardTitle>手动添加数据源</CardTitle>
        <CardDescription>
          直接填写公众号名称和 Fakeid 添加
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">公众号名称</Label>
          <Input
            id="name"
            placeholder="例如：机器之心"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="identifier">Fakeid</Label>
          <Input
            id="identifier"
            placeholder="公众号 Fakeid"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
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
            添加数据源
          </Button>
          <Button variant="outline" onClick={() => navigate("/sources")}>
            取消
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
