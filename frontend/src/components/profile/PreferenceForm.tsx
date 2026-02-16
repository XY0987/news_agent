import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PreferenceForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>偏好表单</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          偏好设置表单将在下一版本中实现
        </p>
      </CardContent>
    </Card>
  );
}
