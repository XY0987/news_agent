import { useEffect } from "react";
import { User, Loader2 } from "lucide-react";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { InterestTags } from "@/components/profile/InterestTags";
import { useUserStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";
import type { UserProfile } from "@/types";

export function ProfilePage() {
  const { user, loading, fetchUser, updateProfile } = useUserStore();

  useEffect(() => {
    if (!user) fetchUser(DEFAULT_USER_ID);
  }, [user, fetchUser]);

  const handleSaveProfile = async (profile: Partial<UserProfile>) => {
    if (user) await updateProfile(user.id, profile);
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
          <User className="h-6 w-6 text-primary" />
          用户画像
        </h1>
        <p className="text-muted-foreground mt-1">
          完善你的画像以获得更精准的推荐
        </p>
      </div>
      <ProfileEditor profile={user.profile} onSave={handleSaveProfile} />
      <InterestTags profile={user.profile} onSave={handleSaveProfile} />
    </div>
  );
}
