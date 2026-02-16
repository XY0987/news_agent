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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { UserPreferences } from "@/types";

interface PreferenceFormProps {
  preferences: UserPreferences;
  onSave: (prefs: Partial<UserPreferences>) => Promise<void>;
}

const timeOptions = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

const topNOptions = [3, 5, 7, 10];

export function PreferenceForm({ preferences, onSave }: PreferenceFormProps) {
  const [form, setForm] = useState<Partial<UserPreferences>>({
    notifyTime: preferences.notifyTime || "08:00",
    notifyChannels: preferences.notifyChannels || ["email"],
    topN: preferences.topN || 5,
    quietHoursStart: preferences.quietHoursStart || "22:00",
    quietHoursEnd: preferences.quietHoursEnd || "08:00",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setForm({
      notifyTime: preferences.notifyTime || "08:00",
      notifyChannels: preferences.notifyChannels || ["email"],
      topN: preferences.topN || 5,
      quietHoursStart: preferences.quietHoursStart || "22:00",
      quietHoursEnd: preferences.quietHoursEnd || "08:00",
    });
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      toast({ title: "保存成功", description: "偏好设置已更新" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setForm((f) => {
      const channels = f.notifyChannels || [];
      return {
        ...f,
        notifyChannels: channels.includes(ch)
          ? channels.filter((c) => c !== ch)
          : [...channels, ch],
      };
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>推送设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>每日推送时间</Label>
            <Select
              value={form.notifyTime}
              onValueChange={(v) => setForm((f) => ({ ...f, notifyTime: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>每日推送数量上限</Label>
            <Select
              value={String(form.topN)}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, topN: parseInt(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {topNOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>推送渠道</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">邮件推送</p>
                  <p className="text-xs text-muted-foreground">
                    每日精选通过邮件发送
                  </p>
                </div>
                <Switch
                  checked={(form.notifyChannels || []).includes("email")}
                  onCheckedChange={() => toggleChannel("email")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">站内通知</p>
                  <p className="text-xs text-muted-foreground">
                    在系统内展示通知
                  </p>
                </div>
                <Switch
                  checked={(form.notifyChannels || []).includes("web")}
                  onCheckedChange={() => toggleChannel("web")}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>免打扰时段</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>开始时间</Label>
              <Select
                value={form.quietHoursStart}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, quietHoursStart: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>结束时间</Label>
              <Select
                value={form.quietHoursEnd}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, quietHoursEnd: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            免打扰时段内不会发送任何推送通知
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        保存偏好设置
      </Button>
    </div>
  );
}
