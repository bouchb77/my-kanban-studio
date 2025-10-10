import { useState, useEffect } from "react";
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
import { CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserColumns, useUserCustomFields } from "@/hooks/useUserSettings";
import { searchCompanies } from "@/services/sipiService";
import { useUserCategories } from "@/hooks/useUserCategories";
import { useEncryptedTasks } from "@/hooks/useEncryptedTasks";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: () => void;
}

export function CreateTaskDialog({ open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { columns } = useUserColumns();
  const { customFields } = useUserCustomFields();
  const { categories } = useUserCategories();
  const { createTask } = useEncryptedTasks();
  const isMobile = useIsMobile();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("todo");
  const [category, setCategory] = useState("general");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [sipiNumber, setSipiNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ name: string; sipi: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

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
  
  // Determine available columns: user columns + system columns, or defaults if no user columns
  let availableColumns;
  if (columns.length > 0) {
    // User has custom columns, add system columns
    const hasTerminee = columns.some(col => col.status === "done");
    availableColumns = hasTerminee ? columns : [...columns, ...systemColumns];
  } else {
    // No custom columns, use defaults (which already include Terminée)
    availableColumns = defaultColumns;
  }

  // Recherche d'entreprise avec debounce
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        setShowResults(true);
        try {
          const results = await searchCompanies(searchQuery, 10);
          setSearchResults(results);
        } catch (error) {
          console.error('Error searching companies:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const handleSelectCompany = (company: { name: string; sipi: string }) => {
    setSipiNumber(company.sipi);
    setCompanyName(company.name);
    setSearchQuery(company.sipi);
    setShowResults(false);
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

      const taskData = {
        title,
        description: description || undefined,
        status: (status || "todo") as "todo" | "in-progress" | "review" | "done",
        priority: (priority || "medium") as "low" | "medium" | "high",
        tags: [],
        assignee: undefined,
        dueDate: dueDate || undefined,
        customFields: customFieldValues,
        sipiNumber: sipiNumber || undefined,
        companyName: companyName || undefined,
        category: category || 'general',
      };

      const newTask = await createTask(taskData);

      if (!newTask) {
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
      setSearchQuery("");
      setSearchResults([]);
      setShowResults(false);
      
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

  const DialogWrapper = isMobile ? Drawer : Dialog;
  const ContentWrapper = isMobile ? DrawerContent : DialogContent;
  const HeaderWrapper = isMobile ? DrawerHeader : DialogHeader;
  const TitleWrapper = isMobile ? DrawerTitle : DialogTitle;

  return (
    <DialogWrapper open={open} onOpenChange={onOpenChange}>
      <ContentWrapper className={isMobile ? "px-4 pb-4 h-[95vh]" : "sm:max-w-md"}>
        <HeaderWrapper className={isMobile ? "px-0 text-center border-b pb-3 mb-4" : ""}>
          <TitleWrapper>Nouvelle tâche</TitleWrapper>
        </HeaderWrapper>
        
        <div className={isMobile ? "overflow-y-auto flex-1 pr-2" : ""}>
        <form onSubmit={handleSubmit} className={isMobile ? "space-y-3 pb-6" : "space-y-4"}>

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

          <div className="space-y-2">
            <Label>Rechercher une entreprise</Label>
            <Popover open={showResults} onOpenChange={setShowResults}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par SIPI ou nom d'entreprise..."
                    className={isMobile ? "h-12 text-base pl-10" : "pl-10"}
                    onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <Command>
                  <CommandList>
                    {isSearching && (
                      <CommandEmpty>Recherche en cours...</CommandEmpty>
                    )}
                    {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                      <CommandEmpty>Aucune entreprise trouvée</CommandEmpty>
                    )}
                    {!isSearching && searchResults.length > 0 && (
                      <CommandGroup>
                        {searchResults.map((company, index) => (
                          <CommandItem
                            key={`${company.sipi}-${index}`}
                            onSelect={() => handleSelectCompany(company)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{company.name}</span>
                              <span className="text-xs text-muted-foreground">SIPI: {company.sipi}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {sipiNumber && companyName && (
            <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-4"}>
              <div className="space-y-2">
                <Label>Numéro SIPI</Label>
                <Input
                  value={sipiNumber}
                  disabled={true}
                  className={isMobile ? "bg-muted h-12 text-base" : "bg-muted"}
                />
              </div>

              <div className="space-y-2">
                <Label>Société</Label>
                <Input
                  value={companyName}
                  disabled={true}
                  className={isMobile ? "bg-muted h-12 text-base" : "bg-muted"}
                />
              </div>
            </div>
          )}

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
              onClick={() => onOpenChange(false)} 
              className={`flex-1 ${isMobile ? "h-12 text-base" : ""}`}
            >
              Annuler
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
        </div>
      </ContentWrapper>
    </DialogWrapper>
  );
}