import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileEditor() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>画像编辑器</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          画像编辑器将在下一版本中实现
        </p>
      </CardContent>
    </Card>
  );
}
