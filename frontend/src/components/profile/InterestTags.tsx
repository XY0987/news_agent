import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InterestTags() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>兴趣标签</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          兴趣标签管理将在下一版本中实现
        </p>
      </CardContent>
    </Card>
  );
}
