import { useState } from "react";
import { ThumbsUp, ThumbsDown, Bookmark, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FeedbackButtonsProps {
  contentId: string;
  currentFeedback?: string;
  onFeedback: (
    contentId: string,
    type: "useful" | "useless" | "save" | "ignore"
  ) => void;
}

const feedbackOptions = [
  {
    type: "useful" as const,
    icon: ThumbsUp,
    label: "有用",
    activeClass: "text-green-600 bg-green-50",
  },
  {
    type: "useless" as const,
    icon: ThumbsDown,
    label: "无用",
    activeClass: "text-red-600 bg-red-50",
  },
  {
    type: "save" as const,
    icon: Bookmark,
    label: "收藏",
    activeClass: "text-blue-600 bg-blue-50",
  },
  {
    type: "ignore" as const,
    icon: EyeOff,
    label: "忽略",
    activeClass: "text-gray-600 bg-gray-100",
  },
];

export function FeedbackButtons({
  contentId,
  currentFeedback,
  onFeedback,
}: FeedbackButtonsProps) {
  const [activeFeedback, setActiveFeedback] = useState<string | undefined>(
    currentFeedback
  );

  const handleClick = (type: "useful" | "useless" | "save" | "ignore") => {
    setActiveFeedback(type);
    onFeedback(contentId, type);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {feedbackOptions.map(({ type, icon: Icon, label, activeClass }) => (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  activeFeedback === type && activeClass
                )}
                onClick={() => handleClick(type)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
