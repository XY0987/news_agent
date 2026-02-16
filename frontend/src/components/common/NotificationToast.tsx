import { Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function NotificationToast() {
  const { toasts } = useToast();
  
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-card border rounded-lg shadow-lg p-4 flex items-start gap-3 max-w-sm"
        >
          <Bell className="h-4 w-4 text-primary mt-0.5" />
          <div>
            {t.title && <p className="font-medium text-sm">{t.title}</p>}
            {t.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {String(t.description)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
