import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/types";

interface ProfileEditorProps {
  profile: UserProfile;
  onSave: (profile: Partial<UserProfile>) => Promise<void>;
}

const roleOptions = [
  "前端工程师",
  "后端工程师",
  "全栈工程师",
  "移动端开发",
  "DevOps",
  "数据工程师",
  "AI/ML 工程师",
  "架构师",
  "技术经理",
  "产品经理",
  "其他",
];

const depthOptions = [
  { value: "overview", label: "概览型 - 快速了解趋势" },
  { value: "intermediate", label: "中等深度 - 理解核心要点" },
  { value: "deep", label: "深度分析 - 详细技术解读" },
];

const formatOptions = [
  { value: "article", label: "文章" },
  { value: "tutorial", label: "教程" },
  { value: "news", label: "新闻" },
  { value: "opinion", label: "观点" },
  { value: "case_study", label: "案例分析" },
];

const languageOptions = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export function ProfileEditor({ profile, onSave }: ProfileEditorProps) {
  const [form, setForm] = useState<Partial<UserProfile>>({
    role: profile.role || "",
    techStack: profile.techStack || [],
    experienceYears: profile.experienceYears || 0,
    companyType: profile.companyType || "",
    contentDepth: profile.contentDepth || "intermediate",
    contentFormats: profile.contentFormats || ["article"],
    languages: profile.languages || ["zh"],
  });
  const [techInput, setTechInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setForm({
      role: profile.role || "",
      techStack: profile.techStack || [],
      experienceYears: profile.experienceYears || 0,
      companyType: profile.companyType || "",
      contentDepth: profile.contentDepth || "intermediate",
      contentFormats: profile.contentFormats || ["article"],
      languages: profile.languages || ["zh"],
    });
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      toast({ title: "保存成功", description: "用户画像已更新" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addTech = () => {
    const val = techInput.trim();
    if (val && !(form.techStack || []).includes(val)) {
      setForm((f) => ({ ...f, techStack: [...(f.techStack || []), val] }));
      setTechInput("");
    }
  };

  const removeTech = (tech: string) => {
    setForm((f) => ({
      ...f,
      techStack: (f.techStack || []).filter((t) => t !== tech),
    }));
  };

  const toggleFormat = (fmt: string) => {
    setForm((f) => {
      const current = f.contentFormats || [];
      return {
        ...f,
        contentFormats: current.includes(fmt)
          ? current.filter((c) => c !== fmt)
          : [...current, fmt],
      };
    });
  };

  const toggleLang = (lang: string) => {
    setForm((f) => {
      const current = f.languages || [];
      return {
        ...f,
        languages: current.includes(lang)
          ? current.filter((l) => l !== lang)
          : [...current, lang],
      };
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>基本信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>职业角色</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>经验年限</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={form.experienceYears || 0}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  experienceYears: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>公司类型</Label>
          <Input
            placeholder="如：互联网大厂、创业公司、外企..."
            value={form.companyType || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyType: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>技术栈</Label>
          <div className="flex gap-2">
            <Input
              placeholder="输入技术关键词，回车添加"
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTech())}
            />
            <Button variant="outline" size="sm" onClick={addTech}>
              添加
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(form.techStack || []).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => removeTech(t)}
              >
                {t} ×
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>内容深度偏好</Label>
          <Select
            value={form.contentDepth}
            onValueChange={(v) => setForm((f) => ({ ...f, contentDepth: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {depthOptions.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>内容形式偏好</Label>
          <div className="flex flex-wrap gap-2">
            {formatOptions.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  (form.contentFormats || []).includes(f.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
                onClick={() => toggleFormat(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>语言偏好</Label>
          <div className="flex flex-wrap gap-2">
            {languageOptions.map((l) => (
              <button
                key={l.value}
                type="button"
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  (form.languages || []).includes(l.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
                onClick={() => toggleLang(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          保存画像
        </Button>
      </CardContent>
    </Card>
  );
}
