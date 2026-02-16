import { useEffect } from "react";
import { SlidersHorizontal, Loader2 } from "lucide-react";
import { PreferenceForm } from "@/components/profile/PreferenceForm";
import { useUserStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";
import type { UserPreferences } from "@/types";

export function PreferencesPage() {
  const { user, loading, fetchUser, updatePreferences } = useUserStore();

  useEffect(() => {
    if (!user) fetchUser(DEFAULT_USER_ID);
  }, [user, fetchUser]);

  const handleSave = async (prefs: Partial<UserPreferences>) => {
    if (user) await updatePreferences(user.id, prefs);
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6 text-primary" />
          偏好设置
        </h1>
        <p className="text-muted-foreground mt-1">自定义推送和评分偏好</p>
      </div>
      <PreferenceForm preferences={user.preferences} onSave={handleSave} />
    </div>
  );
}
