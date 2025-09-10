import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityFlagProps {
  priority: "low" | "medium" | "high";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const priorityConfig = {
  low: {
    color: "text-muted-foreground",
    bgColor: "bg-muted-foreground/10",
    label: "Faible"
  },
  medium: {
    color: "text-warning",
    bgColor: "bg-warning/10",
    label: "Moyenne"
  },
  high: {
    color: "text-destructive",
    bgColor: "bg-destructive/10", 
    label: "Élevée"
  }
};

const sizeConfig = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-5 h-5"
};

export function PriorityFlag({ priority, size = "sm", className }: PriorityFlagProps) {
  const config = priorityConfig[priority];
  const sizeClass = sizeConfig[size];

  return (
    <div 
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1",
        config.bgColor,
        className
      )}
      title={`Priorité ${config.label}`}
    >
      <Flag 
        className={cn(
          sizeClass,
          config.color
        )} 
      />
    </div>
  );
}