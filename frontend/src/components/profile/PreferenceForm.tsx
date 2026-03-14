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

const topNOptions = [3, 5, 7, 10];

export function PreferenceForm({ preferences, onSave }: PreferenceFormProps) {
  const [form, setForm] = useState<Partial<UserPreferences>>({
    notifyTime: preferences.notifyTime || "08:00",
    notifyChannels: preferences.notifyChannels || ["email"],
    topN: preferences.topN || 5,
    quietHoursStart: preferences.quietHoursStart || "22:00",
    quietHoursEnd: preferences.quietHoursEnd || "08:00",
    detailedNotify: preferences.detailedNotify ?? false,
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
      detailedNotify: preferences.detailedNotify ?? false,
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
            <Input
              type="time"
              value={form.notifyTime || "08:00"}
              onChange={(e) =>
                setForm((f) => ({ ...f, notifyTime: e.target.value }))
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Agent 将在此时间自动启动，执行采集、评分、摘要、推送全流程
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">详细运行通知</p>
              <p className="text-xs text-muted-foreground">
                开启后 Agent 启动时发送通知邮件，失败时发送详细报错信息
              </p>
            </div>
            <Switch
              checked={form.detailedNotify ?? false}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, detailedNotify: v }))
              }
            />
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
              <Input
                type="time"
                value={form.quietHoursStart || "22:00"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quietHoursStart: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>结束时间</Label>
              <Input
                type="time"
                value={form.quietHoursEnd || "08:00"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quietHoursEnd: e.target.value }))
                }
              />
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
