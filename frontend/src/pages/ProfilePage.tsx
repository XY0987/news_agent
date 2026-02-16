import { User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          用户画像
        </h1>
        <p className="text-muted-foreground mt-1">
          完善你的画像以获得更精准的推荐
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            画像编辑功能将在下一版本中实现
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
