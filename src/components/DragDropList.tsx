import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragDropItem {
  id: string;
  order: number;
  [key: string]: any;
}

interface SortableItemProps {
  item: DragDropItem;
  children: React.ReactNode;
  className?: string;
}

function SortableItem({ item, children, className }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-4", className)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

interface DragDropListProps<T extends DragDropItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
  itemClassName?: string;
}

export function DragDropList<T extends DragDropItem>({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
}: DragDropListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort items by order
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
      const newIndex = sortedItems.findIndex((item) => item.id === over?.id);

      const reorderedItems = arrayMove(sortedItems, oldIndex, newIndex);
      
      // Update order values based on new positions
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        order: index + 1,
      }));

      onReorder(updatedItems);
    }

    setActiveId(null);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortedItems} strategy={verticalListSortingStrategy}>
          {sortedItems.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              className={itemClassName}
            >
              {renderItem(item)}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}