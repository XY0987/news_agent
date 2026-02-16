import { useState, useEffect } from "react";
import { Save, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/types";

interface InterestTagsProps {
  profile: UserProfile;
  onSave: (profile: Partial<UserProfile>) => Promise<void>;
}

const suggestedTags = [
  "React",
  "Vue",
  "TypeScript",
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "AI/ML",
  "LLM",
  "DevOps",
  "Kubernetes",
  "微服务",
  "前端工程化",
  "性能优化",
  "系统设计",
  "分布式系统",
  "数据库",
  "云原生",
  "安全",
  "低代码",
];

export function InterestTags({ profile, onSave }: InterestTagsProps) {
  const [primary, setPrimary] = useState<string[]>(
    profile.primaryInterests || []
  );
  const [secondary, setSecondary] = useState<string[]>(
    profile.secondaryInterests || []
  );
  const [exclude, setExclude] = useState<string[]>(profile.excludeTags || []);
  const [input, setInput] = useState("");
  const [activeSection, setActiveSection] = useState<
    "primary" | "secondary" | "exclude"
  >("primary");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPrimary(profile.primaryInterests || []);
    setSecondary(profile.secondaryInterests || []);
    setExclude(profile.excludeTags || []);
  }, [profile]);

  const addTag = (tag: string, section: "primary" | "secondary" | "exclude") => {
    const val = tag.trim();
    if (!val) return;
    if (section === "primary" && !primary.includes(val)) {
      setPrimary((p) => [...p, val]);
    } else if (section === "secondary" && !secondary.includes(val)) {
      setSecondary((s) => [...s, val]);
    } else if (section === "exclude" && !exclude.includes(val)) {
      setExclude((e) => [...e, val]);
    }
    setInput("");
  };

  const removeTag = (
    tag: string,
    section: "primary" | "secondary" | "exclude"
  ) => {
    if (section === "primary") setPrimary((p) => p.filter((t) => t !== tag));
    else if (section === "secondary")
      setSecondary((s) => s.filter((t) => t !== tag));
    else setExclude((e) => e.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        primaryInterests: primary,
        secondaryInterests: secondary,
        excludeTags: exclude,
      });
      toast({ title: "保存成功", description: "兴趣标签已更新" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const allUsed = [...primary, ...secondary, ...exclude];
  const availableSuggestions = suggestedTags.filter(
    (t) => !allUsed.includes(t)
  );

  const renderTags = (
    tags: string[],
    section: "primary" | "secondary" | "exclude",
    color: string
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className={`${color} cursor-pointer group`}
          onClick={() => removeTag(tag, section)}
        >
          {tag}
          <X className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Badge>
      ))}
      {tags.length === 0 && (
        <span className="text-xs text-muted-foreground">暂无标签</span>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>兴趣标签管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">主要兴趣（权重高）</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Agent 会优先推送这些领域的内容
            </p>
            {renderTags(primary, "primary", "bg-green-100 text-green-700")}
          </div>

          <div>
            <Label className="text-sm font-medium">次要兴趣</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Agent 也会关注这些领域
            </p>
            {renderTags(
              secondary,
              "secondary",
              "bg-blue-100 text-blue-700"
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">排除标签</Label>
            <p className="text-xs text-muted-foreground mb-2">
              包含这些标签的内容将被过滤
            </p>
            {renderTags(exclude, "exclude", "bg-red-100 text-red-700")}
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label>添加标签</Label>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1">
              {(
                [
                  ["primary", "主要"],
                  ["secondary", "次要"],
                  ["exclude", "排除"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    activeSection === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:border-primary/50"
                  }`}
                  onClick={() => setActiveSection(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input
              className="flex-1"
              placeholder="输入标签名，回车添加"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(input, activeSection);
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => addTag(input, activeSection)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {availableSuggestions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">快速添加：</p>
              <div className="flex flex-wrap gap-1">
                {availableSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="px-2 py-0.5 text-xs rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    onClick={() => addTag(tag, activeSection)}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          保存兴趣标签
        </Button>
      </CardContent>
    </Card>
  );
}
