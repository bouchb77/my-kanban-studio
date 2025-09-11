import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings2, Eye, EyeOff } from "lucide-react";
import { DragDropList } from "./DragDropList";
import { useUserCustomFields } from "@/hooks/useUserSettings";
import { useUserViewPreferences } from "@/hooks/useUserViewPreferences";

export interface ColumnDefinition {
  id: string;
  label: string;
  type: 'system' | 'custom_field';
  required?: boolean;
  order: number;
}

const SYSTEM_COLUMNS: ColumnDefinition[] = [
  { id: 'select', label: 'Sélection', type: 'system', required: true, order: 0 },
  { id: 'title', label: 'Titre', type: 'system', required: true, order: 1 },
  { id: 'status', label: 'Statut', type: 'system', order: 2 },
  { id: 'priority', label: 'Priorité', type: 'system', order: 3 },
  { id: 'category', label: 'Catégorie', type: 'system', order: 4 },
  { id: 'assignee', label: 'Assigné à', type: 'system', order: 5 },
  { id: 'dueDate', label: "Échéance", type: 'system', order: 6 },
  { id: 'tags', label: 'Tags', type: 'system', order: 7 },
  { id: 'sipi_number', label: 'Numéro SIPI', type: 'system', order: 8 },
  { id: 'company_name', label: 'Société', type: 'system', order: 9 },
  { id: 'actions', label: 'Actions', type: 'system', required: true, order: 100 },
];

interface ColumnManagerProps {}

export function ColumnManager({}: ColumnManagerProps) {
  const [open, setOpen] = useState(false);
  const { customFields } = useUserCustomFields();
  const { preferences, toggleColumnVisibility, reorderColumns } = useUserViewPreferences('table');

  // Build complete column definitions (NO Kanban columns here)
  const allColumns: ColumnDefinition[] = [
    ...SYSTEM_COLUMNS,
    ...customFields.map(field => ({
      id: `custom_field_${field.id}`,
      label: field.name,
      type: 'custom_field' as const,
      order: 50 + field.order,
    })),
  ];

  // Local state to make UI responsive immediately
  const [localVisible, setLocalVisible] = useState<string[]>([]);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  useEffect(() => {
    const requiredDefaults = allColumns
      .filter(col => col.required)
      .map(col => col.id);

    const visible = preferences?.visible_columns?.length
      ? preferences.visible_columns.filter(id => allColumns.find(c => c.id === id))
      : [...requiredDefaults, 'status', 'priority', 'dueDate'];

    const order = preferences?.column_order?.length
      ? preferences.column_order.filter(id => allColumns.find(c => c.id === id))
      : allColumns.sort((a, b) => a.order - b.order).map(c => c.id);

    setLocalVisible(visible);
    setLocalOrder(order);
  }, [preferences?.visible_columns, preferences?.column_order, allColumns.length]);

  const visibleColumnObjects = allColumns
    .filter(col => localVisible.includes(col.id))
    .sort((a, b) => {
      const aIndex = localOrder.indexOf(a.id);
      const bIndex = localOrder.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return a.order - b.order;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

  const handleToggleColumn = async (columnId: string) => {
    try {
      const next = localVisible.includes(columnId)
        ? localVisible.filter(id => id !== columnId)
        : [...localVisible, columnId];
      setLocalVisible(next);
      await toggleColumnVisibility(columnId);
    } catch (error) {
      console.error('Error toggling column visibility:', error);
    }
  };

  const handleReorderColumns = async (reorderedItems: ColumnDefinition[]) => {
    try {
      const newVisibleOrder = reorderedItems.map(item => item.id);
      const nonVisible = localOrder.filter(id => !localVisible.includes(id));
      const finalOrder = [...newVisibleOrder, ...nonVisible];
      setLocalOrder(finalOrder);
      await reorderColumns(finalOrder);
    } catch (error) {
      console.error('Error reordering columns:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="w-4 h-4 mr-2" />
          Colonnes
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>Gestion des colonnes</SheetTitle>
          <SheetDescription>
            Choisissez les colonnes visibles et réorganisez l'ordre (seulement les colonnes sélectionnées)
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Column Visibility */}
          <div>
            <h4 className="text-sm font-medium mb-3">Colonnes visibles</h4>
            <div className="space-y-1 max-h-[260px] overflow-y-auto">
              {allColumns.map((column) => (
                <div key={column.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={localVisible.includes(column.id)}
                      onCheckedChange={() => handleToggleColumn(column.id)}
                      disabled={column.required}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{column.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {column.type === 'system' ? 'Système' : 'Champ'}
                      </Badge>
                      {column.required && (
                        <Badge variant="secondary" className="text-xs">
                          Requis
                        </Badge>
                      )}
                    </div>
                  </div>
                  {localVisible.includes(column.id) ? (
                    <Eye className="w-4 h-4 text-success" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Column Order - Only visible columns */}
          <div>
            <h4 className="text-sm font-medium mb-3">
              Ordre des colonnes visibles ({visibleColumnObjects.length})
            </h4>
            {visibleColumnObjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune colonne visible sélectionnée
              </p>
            ) : (
              <div className="max-h-[240px] overflow-y-auto">
                <DragDropList
                  items={visibleColumnObjects.map((col, index) => ({ ...col, order: index }))}
                  onReorder={handleReorderColumns}
                  renderItem={(column) => (
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{column.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {column.type === 'system' ? 'Système' : 'Champ'}
                        </Badge>
                      </div>
                      <Eye className="w-4 h-4 text-success" />
                    </div>
                  )}
                  itemClassName="p-2 bg-background rounded border"
                />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
