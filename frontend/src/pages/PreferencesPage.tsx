import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PreferencesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6 text-primary" />
          偏好设置
        </h1>
        <p className="text-muted-foreground mt-1">自定义推送和评分偏好</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>推送设置</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            偏好设置功能将在下一版本中实现
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
