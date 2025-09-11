import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Check, X, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  value: any;
  onSave: (value: any) => Promise<void>;
  type: "text" | "select" | "date" | "tags";
  options?: { value: string; label: string; color?: string }[];
  placeholder?: string;
  className?: string;
  displayValue?: React.ReactNode;
  disabled?: boolean;
}

export function InlineEditField({
  value,
  onSave,
  type,
  options = [],
  placeholder = "",
  className = "",
  displayValue,
  disabled = false
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving field:", error);
      setEditValue(value); // Reset on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type === "text") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (disabled) {
    return (
      <div className={className}>
        {displayValue || value || placeholder}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div 
        className={cn(
          "group cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors min-h-[24px] flex items-center gap-2",
          className
        )}
        onClick={() => setIsEditing(true)}
      >
        <div className="flex-1">
          {displayValue || value || (
            <span className="text-muted-foreground italic">{placeholder}</span>
          )}
        </div>
        <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  // Text input
  if (type === "text") {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editValue || ""}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          className="h-8 text-sm"
          autoFocus
          disabled={isLoading}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleSave}
          disabled={isLoading}
        >
          <Check className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  // Select dropdown
  if (type === "select") {
    return (
      <div className="flex items-center gap-1">
        <Select value={editValue} onValueChange={(val) => {
          setEditValue(val);
          setTimeout(async () => {
            await onSave(val);
            setIsEditing(false);
          }, 100);
        }}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {option.color && (
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  // Date picker
  if (type === "date") {
    return (
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 text-sm justify-start font-normal">
              <CalendarIcon className="mr-2 h-3 w-3" />
              {editValue ? format(new Date(editValue), "PPP", { locale: fr }) : "Sélectionner"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={editValue ? new Date(editValue) : undefined}
              onSelect={(date) => {
                setEditValue(date);
                setTimeout(async () => {
                  await onSave(date);
                  setIsEditing(false);
                }, 100);
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  // Tags input
  if (type === "tags") {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={Array.isArray(editValue) ? editValue.join(", ") : ""}
          onChange={(e) => {
            const tags = e.target.value.split(",").map(tag => tag.trim()).filter(Boolean);
            setEditValue(tags);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="Tags séparés par des virgules"
          className="h-8 text-sm"
          autoFocus
          disabled={isLoading}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleSave}
          disabled={isLoading}
        >
          <Check className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return null;
}