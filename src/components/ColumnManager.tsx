import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings2, Eye, EyeOff, GripVertical } from "lucide-react";
import { DragDropList } from "./DragDropList";
import { useUserColumns, useUserCustomFields } from "@/hooks/useUserSettings";
import { useUserViewPreferences } from "@/hooks/useUserViewPreferences";

export interface ColumnDefinition {
  id: string;
  label: string;
  type: 'system' | 'user_column' | 'custom_field';
  required?: boolean;
  order: number;
}

const SYSTEM_COLUMNS: ColumnDefinition[] = [
  { id: 'select', label: 'Sélection', type: 'system', required: true, order: 0 },
  { id: 'title', label: 'Titre', type: 'system', required: true, order: 1 },
  { id: 'status', label: 'Statut', type: 'system', required: true, order: 2 },
  { id: 'priority', label: 'Priorité', type: 'system', required: true, order: 3 },
  { id: 'assignee', label: 'Assigné à', type: 'system', order: 4 },
  { id: 'dueDate', label: 'Échéance', type: 'system', order: 5 },
  { id: 'tags', label: 'Tags', type: 'system', order: 6 },
  { id: 'actions', label: 'Actions', type: 'system', required: true, order: 100 },
];

interface ColumnManagerProps {
  onColumnOrderChange?: (columnOrder: string[]) => void;
  onVisibleColumnsChange?: (visibleColumns: string[]) => void;
}

export function ColumnManager({ onColumnOrderChange, onVisibleColumnsChange }: ColumnManagerProps) {
  const [open, setOpen] = useState(false);
  const { columns: userColumns } = useUserColumns();
  const { customFields } = useUserCustomFields();
  const { preferences, toggleColumnVisibility, reorderColumns } = useUserViewPreferences('table');

  // Build complete column definitions
  const allColumns: ColumnDefinition[] = [
    ...SYSTEM_COLUMNS,
    ...userColumns.map(col => ({
      id: `user_column_${col.id}`,
      label: col.title,
      type: 'user_column' as const,
      order: 10 + col.order,
    })),
    ...customFields.map(field => ({
      id: `custom_field_${field.id}`,
      label: field.name,
      type: 'custom_field' as const,
      order: 50 + field.order,
    })),
  ];

  // Get current visible columns with defaults
  const getVisibleColumns = () => {
    if (preferences?.visible_columns && preferences.visible_columns.length > 0) {
      return preferences.visible_columns;
    }
    // Default visible columns
    return allColumns
      .filter(col => col.required || ['title', 'status', 'priority', 'dueDate'].includes(col.id))
      .map(col => col.id);
  };

  // Get current column order with defaults
  const getColumnOrder = () => {
    if (preferences?.column_order && preferences.column_order.length > 0) {
      return preferences.column_order;
    }
    // Default order
    return allColumns
      .sort((a, b) => a.order - b.order)
      .map(col => col.id);
  };

  const visibleColumns = getVisibleColumns();
  const columnOrder = getColumnOrder();

  // Sort columns by current order
  const sortedColumns = allColumns
    .sort((a, b) => {
      const aIndex = columnOrder.indexOf(a.id);
      const bIndex = columnOrder.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return a.order - b.order;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

  const handleToggleColumn = async (columnId: string) => {
    await toggleColumnVisibility(columnId);
    const newVisible = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    onVisibleColumnsChange?.(newVisible);
  };

  const handleReorderColumns = async (reorderedItems: any[]) => {
    const newOrder = reorderedItems.map(item => item.id);
    await reorderColumns(newOrder);
    onColumnOrderChange?.(newOrder);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="w-4 h-4 mr-2" />
          Colonnes
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Gestion des colonnes</SheetTitle>
          <SheetDescription>
            Personnalisez l'affichage et l'ordre des colonnes dans votre vue liste
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Column Visibility */}
          <div>
            <h4 className="text-sm font-medium mb-4">Colonnes visibles</h4>
            <div className="space-y-3">
              {allColumns.map((column) => (
                <div key={column.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={visibleColumns.includes(column.id)}
                      onCheckedChange={() => handleToggleColumn(column.id)}
                      disabled={column.required}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{column.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {column.type === 'system' ? 'Système' : 
                         column.type === 'user_column' ? 'Colonne' : 'Champ perso'}
                      </Badge>
                      {column.required && (
                        <Badge variant="secondary" className="text-xs">
                          Requis
                        </Badge>
                      )}
                    </div>
                  </div>
                  {visibleColumns.includes(column.id) ? (
                    <Eye className="w-4 h-4 text-success" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Column Order */}
          <div>
            <h4 className="text-sm font-medium mb-4">Ordre des colonnes</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Glissez-déposez pour réorganiser l'ordre d'affichage
            </p>
            <DragDropList
              items={sortedColumns.map((col, index) => ({ ...col, order: index }))}
              onReorder={handleReorderColumns}
              renderItem={(column) => (
                <div className="flex items-center justify-between p-3 bg-surface-variant rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{column.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {column.type === 'system' ? 'Système' : 
                       column.type === 'user_column' ? 'Colonne' : 'Champ perso'}
                    </Badge>
                  </div>
                  {visibleColumns.includes(column.id) ? (
                    <Eye className="w-4 h-4 text-success" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              )}
              itemClassName="p-4 bg-background rounded-lg border"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}