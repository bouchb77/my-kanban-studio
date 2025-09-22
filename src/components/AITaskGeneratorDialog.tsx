import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserColumns, useUserCustomFields } from "@/hooks/useUserSettings";
import { getCompanyBySipi, validateSipiFormat } from "@/services/sipiService";
import { useUserCategories } from "@/hooks/useUserCategories";

interface AITaskGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: () => void;
}

export function AITaskGeneratorDialog({ open, onOpenChange, onTaskCreated }: AITaskGeneratorDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { columns } = useUserColumns();
  const { customFields } = useUserCustomFields();
  const { categories } = useUserCategories();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("todo");
  const [category, setCategory] = useState("general");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [sipiNumber, setSipiNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoadingSipi, setIsLoadingSipi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingWithAI, setIsGeneratingWithAI] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Default columns as fallback
  const defaultColumns = [
    { status: "todo", title: "À faire" },
    { status: "in-progress", title: "En cours" },
    { status: "review", title: "En révision" },
    { status: "done", title: "Terminé" },
  ];

  const availableColumns = columns.length > 0 ? columns : defaultColumns;

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

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une description pour l'IA",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingWithAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-task-ai', {
        body: { 
          prompt: aiPrompt,
          userCategories: categories 
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success && data?.task) {
        const task = data.task;
        setTitle(task.title || "");
        setDescription(task.description || "");
        setPriority(task.priority || "medium");
        setCategory(task.category || "general");
        setHasGenerated(true);
        
        toast({
          title: "Tâche générée",
          description: "L'IA a généré votre tâche avec succès",
        });
      } else {
        throw new Error(data?.error || "Erreur lors de la génération");
      }
    } catch (error) {
      console.error('Error generating task with AI:', error);
      toast({
        title: "Erreur IA",
        description: "Impossible de générer la tâche avec l'IA",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingWithAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!user) {
        toast({
          title: "Erreur",
          description: "Vous devez être connecté pour créer une tâche",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .insert([
          {
            title,
            description: description || null,
            priority: priority || 'medium',
            status,
            category: category || 'general',
            due_date: dueDate?.toISOString() || null,
            tags: [],
            user_id: user.id,
            sipi_number: sipiNumber || null,
            company_name: companyName || null,
            custom_fields: customFieldValues
          }
        ]);

      if (error) {
        console.error('Error creating task:', error);
        toast({
          title: "Erreur",
          description: "Impossible de créer la tâche",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Tâche créée",
        description: "La tâche a été créée avec succès",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setPriority("");
      setStatus("todo");
      setCategory("general");
      setDueDate(undefined);
      setCustomFieldValues({});
      setSipiNumber("");
      setCompanyName("");
      setAiPrompt("");
      setHasGenerated(false);
      
      // Close dialog
      onOpenChange(false);

      // Notify parent components
      onTaskCreated?.();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isMobile = useIsMobile();
  
  const DialogWrapper = isMobile ? Drawer : Dialog;
  const ContentWrapper = isMobile ? DrawerContent : DialogContent;
  const HeaderWrapper = isMobile ? DrawerHeader : DialogHeader;
  const TitleWrapper = isMobile ? DrawerTitle : DialogTitle;

  return (
    <DialogWrapper open={open} onOpenChange={onOpenChange}>
      <ContentWrapper className={isMobile ? "px-4 pb-4 h-[95vh]" : "sm:max-w-md max-h-[90vh] overflow-y-auto"}>
        <HeaderWrapper className={isMobile ? "px-0 text-center border-b pb-3 mb-4" : ""}>
          <TitleWrapper className="flex items-center gap-2 justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
            Création de tâche avec IA
          </TitleWrapper>
        </HeaderWrapper>
        
        <div className={isMobile ? "overflow-y-auto flex-1 pr-2" : ""}>
        
        {!hasGenerated ? (
          <div className={isMobile ? "space-y-3" : "space-y-4"}>
            <div className="space-y-3 p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
              <Label className="text-sm font-medium">Décrivez votre tâche</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex: Créer un rapport de ventes pour le mois de janvier avec graphiques et analyses des tendances..."
                rows={isMobile ? 3 : 4}
                className={isMobile ? "text-base" : ""}
              />
              <Button
                onClick={generateWithAI}
                disabled={isGeneratingWithAI || !aiPrompt.trim()}
                className={`w-full ${isMobile ? "h-12 text-base" : ""}`}
                style={{ background: "var(--gradient-primary)" }}
              >
                {isGeneratingWithAI ? "L'IA travaille..." : "Générer la tâche"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={isMobile ? "space-y-3" : "space-y-4"}>
            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nom de la tâche"
                className={isMobile ? "h-12 text-base" : ""}
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
                className={isMobile ? "text-base" : ""}
                rows={isMobile ? 2 : 3}
              />
            </div>

            <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-4"}>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className={isMobile ? "h-12" : ""}>
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
                  <SelectTrigger className={isMobile ? "h-12" : ""}>
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
                <SelectTrigger className={isMobile ? "h-12" : ""}>
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

            <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-4"}>
              <div className="space-y-2">
                <Label>Numéro SIPI</Label>
                <Input
                  value={sipiNumber}
                  onChange={(e) => handleSipiChange(e.target.value)}
                  placeholder="12345678"
                  className={isMobile ? "h-12 text-base" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>Société</Label>
                <Input
                  value={companyName}
                  placeholder="Nom de l'entreprise"
                  disabled={true}
                  className={isMobile ? "bg-muted h-12 text-base" : "bg-muted"}
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
                {field.type === "textarea" && (
                  <Textarea
                    id={field.id}
                    value={customFieldValues[field.id] || ""}
                    onChange={(e) => setCustomFieldValues(prev => ({
                      ...prev,
                      [field.id]: e.target.value
                    }))}
                    placeholder={`Entrez ${field.name.toLowerCase()}`}
                    required={field.required}
                    rows={3}
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
                {field.type === "number" && (
                  <Input
                    id={field.id}
                    type="number"
                    value={customFieldValues[field.id] || ""}
                    onChange={(e) => setCustomFieldValues(prev => ({
                      ...prev,
                      [field.id]: Number(e.target.value)
                    }))}
                    placeholder={`Entrez ${field.name.toLowerCase()}`}
                    required={field.required}
                  />
                )}
              </div>
            ))}

            <div className={`flex gap-2 ${isMobile ? "pt-6 pb-2" : "pt-4"}`}>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setHasGenerated(false);
                  setTitle("");
                  setDescription("");
                  setPriority("");
                  setCategory("general");
                }} 
                className={`flex-1 ${isMobile ? "h-12 text-base" : ""}`}
              >
                Regenerer
              </Button>
              <Button 
                type="submit" 
                className={`flex-1 ${isMobile ? "h-12 text-base" : ""}`}
                style={{ background: "var(--gradient-primary)" }}
                disabled={!title.trim() || isLoading}
              >
                {isLoading ? "Création..." : "Créer la tâche"}
              </Button>
            </div>
          </form>
        )}
        </div>
      </ContentWrapper>
    </DialogWrapper>
  );
}