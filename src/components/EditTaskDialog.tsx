import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserColumns, useUserCustomFields } from "@/hooks/useUserSettings";
import { Task } from "@/types/task";
import { Switch } from "@/components/ui/switch";
import { getCompanyBySipi, validateSipiFormat } from "@/services/sipiService";
import { useUserCategories } from "@/hooks/useUserCategories";

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onTaskUpdated?: () => void;
}

export function EditTaskDialog({ open, onOpenChange, task, onTaskUpdated }: EditTaskDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { columns } = useUserColumns();
  const { customFields } = useUserCustomFields();
  const { categories } = useUserCategories();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [sipiNumber, setSipiNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoadingSipi, setIsLoadingSipi] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Default columns as fallback
  const defaultColumns = [
    { status: "todo", title: "À faire" },
    { status: "in-progress", title: "En cours" },
    { status: "review", title: "En révision" },
    { status: "done", title: "Terminée" },
  ];

  // System columns that are always present
  const systemColumns = [
    { status: "done", title: "Terminée" }
  ];
  
  // Combine user columns with system columns
  const allColumns = [...columns, ...systemColumns];
  const availableColumns = allColumns.length > 0 ? allColumns : defaultColumns;

  const handleSipiChange = async (value: string) => {
    setSipiNumber(value);
    
    if (value && validateSipiFormat(value)) {
      setIsLoadingSipi(true);
      try {
        const company = await getCompanyBySipi(value);
        if (company) {
          setCompanyName(company.name);
        } else {
          setCompanyName("");
        }
      } finally {
        setIsLoadingSipi(false);
      }
    } else {
      setCompanyName("");
    }
  };

  // Load task data when dialog opens
  useEffect(() => {
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setStatus(task.status);
      setCategory(task.category || "general");
      setDueDate(task.dueDate);
      // Support both camelCase and snake_case coming from different hooks
      const sipi = (task as any).sipiNumber ?? (task as any).sipi_number ?? "";
      const company = (task as any).companyName ?? (task as any).company_name ?? "";
      setSipiNumber(sipi);
      setCompanyName(company);
      // Load existing custom field values
      setCustomFieldValues(task.customFields || {});
    }
  }, [open, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !user) return;
    
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title,
          description: description || null,
          priority: priority || 'medium',
          status,
          category: category || 'general',
          due_date: dueDate?.toISOString() || null,
          custom_fields: customFieldValues,
          sipi_number: sipiNumber || null,
          company_name: companyName || null,
        })
        .eq('id', task.id);

      if (error) {
        console.error('Error updating task:', error);
        toast({
          title: "Erreur",
          description: "Impossible de modifier la tâche",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Tâche modifiée",
        description: "La tâche a été modifiée avec succès",
      });

      // Close dialog
      onOpenChange(false);

      // Notify parent components
      onTaskUpdated?.();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la tâche</DialogTitle>
          <DialogDescription>
            Modifiez les détails de votre tâche
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de la tâche"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de la tâche"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map((column) => (
                    <SelectItem key={column.status} value={column.status}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Élevée</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name || cat.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="general">Général</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date d'échéance</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP", { locale: fr }) : "Sélectionner une date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numéro SIPI</Label>
              <Input
                value={sipiNumber}
                onChange={(e) => handleSipiChange(e.target.value)}
                placeholder="12345678"
              />
            </div>

            <div className="space-y-2">
              <Label>Société</Label>
              <Input
                value={companyName}
                placeholder="Nom de l'entreprise"
                disabled={true}
                className="bg-muted"
              />
            </div>
          </div>

          {/* Custom Fields */}
          {customFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>
                {field.name} {field.required && "*"}
              </Label>
              {field.type === "text" && (
                <Input
                  id={field.id}
                  value={customFieldValues[field.id] || ""}
                  onChange={(e) => setCustomFieldValues(prev => ({
                    ...prev,
                    [field.id]: e.target.value
                  }))}
                  placeholder={`Entrez ${field.name.toLowerCase()}`}
                  required={field.required}
                />
              )}
              {field.type === "number" && (
                <Input
                  id={field.id}
                  type="number"
                  value={customFieldValues[field.id] ?? ""}
                  onChange={(e) => setCustomFieldValues(prev => ({
                    ...prev,
                    [field.id]: e.target.value === "" ? "" : Number(e.target.value)
                  }))}
                  placeholder={`Entrez ${field.name.toLowerCase()}`}
                  required={field.required}
                />
              )}
              {field.type === "select" && field.options && (
                <Select 
                  value={customFieldValues[field.id] || ""} 
                  onValueChange={(value) => setCustomFieldValues(prev => ({
                    ...prev,
                    [field.id]: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Sélectionner ${field.name.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option: string, index: number) => (
                      <SelectItem key={option} value={option || `option-${index}`}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.type === "date" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFieldValues[field.id] 
                        ? format(new Date(customFieldValues[field.id]), "PPP", { locale: fr }) 
                        : `Sélectionner ${field.name.toLowerCase()}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFieldValues[field.id] ? new Date(customFieldValues[field.id]) : undefined}
                      onSelect={(date) => setCustomFieldValues(prev => ({
                        ...prev,
                        [field.id]: date ? date.toISOString() : null
                      }))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
              {field.type === "checkbox" && (
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={Boolean(customFieldValues[field.id])}
                    onCheckedChange={(checked) => setCustomFieldValues(prev => ({
                      ...prev,
                      [field.id]: checked
                    }))}
                  />
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              style={{ background: "var(--gradient-primary)" }}
              disabled={!title.trim() || isLoading}
            >
              {isLoading ? "Modification..." : "Modifier la tâche"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}