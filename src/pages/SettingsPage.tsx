import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Columns, 
  Bell, 
  User, 
  Plus, 
  Trash2,
  Edit,
  Save,
  Users
} from "lucide-react";
import { DragDropList } from "@/components/DragDropList";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUserViewPreferences } from "@/hooks/useUserViewPreferences";
import { useUserCategories } from "@/hooks/useUserCategories";
import { useUserRole } from "@/hooks/useUserRole";
import { UserApprovalPanel } from "@/components/UserApprovalPanel";

interface UserColumn {
  id: string;
  title: string;
  status: string;
  color: string;
  order: number;
}

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox';
  options?: string[];
  required: boolean;
  order: number;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  daysBeforeDue: number;
  dailyDigest: boolean;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Kanban card preferences
  const { preferences: kanbanPreferences, savePreferences: saveKanbanPreferences } = useUserViewPreferences('kanban');
  
  // Default system fields that should always be displayed (read-only)
  const systemFields = [
    { id: 'title', name: 'Titre', type: 'text', required: true, system: true },
    { id: 'description', name: 'Description', type: 'textarea', required: false, system: true },
    { id: 'status', name: 'Statut', type: 'select', required: true, system: true },
    { id: 'priority', name: 'Priorité', type: 'select', required: true, system: true },
    { id: 'category', name: 'Catégorie', type: 'select', required: false, system: true },
    { id: 'due_date', name: 'Date d\'échéance', type: 'date', required: false, system: true },
    { id: 'sipi_number', name: 'Numéro SIPI', type: 'text', required: false, system: true },
    { id: 'company_name', name: 'Société', type: 'text', required: false, system: true }
  ];
  
  // Categories management
  const { categories: userCategories, saveCategory, updateCategory, deleteCategory, reorderCategories } = useUserCategories();
  const [newCategoryName, setNewCategoryName] = useState("");
  
  const [columns, setColumns] = useState<UserColumn[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    push: true,
    daysBeforeDue: 3,
    dailyDigest: false,
  });
  
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'date' | 'checkbox'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState("");

  // Load data from Supabase
  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    try {
      // Load columns
      const { data: columnsData, error: columnsError } = await supabase
        .from('user_columns')
        .select('*')
        .order('order');
      
      if (columnsError) throw columnsError;
      
      // Load custom fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('user_custom_fields')
        .select('*')
        .order('order');
      
      if (fieldsError) throw fieldsError;
      
      // Load preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from('user_preferences')
        .select('*')
        .single();
      
      if (prefsError && prefsError.code !== 'PGRST116') throw prefsError;
      
      setColumns(columnsData || []);
      setCustomFields((fieldsData || []).map(field => ({
        id: field.id,
        name: field.name,
        type: field.type as 'text' | 'number' | 'select' | 'date' | 'checkbox',
        options: Array.isArray(field.options) ? field.options as string[] : [],
        required: field.required || false,
        order: field.order || 0
      })));
      
      if (prefsData?.notifications) {
        const notifs = prefsData.notifications as any;
        if (typeof notifs === 'object' && notifs !== null) {
          setNotifications({
            email: notifs.email || true,
            push: notifs.push || true,
            daysBeforeDue: notifs.daysBeforeDue || 3,
            dailyDigest: notifs.dailyDigest || false
          });
        }
      }
      
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les paramètres",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateColumn = async (columnId: string, updates: Partial<UserColumn>) => {
    const { error } = await supabase
      .from('user_columns')
      .update(updates)
      .eq('id', columnId);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la colonne",
        variant: "destructive",
      });
    } else {
      setColumns(prev => prev.map(col => 
        col.id === columnId ? { ...col, ...updates } : col
      ));
    }
  };

  const updateColumnOrder = async (reorderedColumns: UserColumn[]) => {
    try {
      // Update each column's order in the database
      const updates = reorderedColumns.map((column, index) => 
        supabase
          .from('user_columns')
          .update({ order: index + 1 })
          .eq('id', column.id)
      );
      
      await Promise.all(updates);
      
      setColumns(reorderedColumns.map((col, index) => ({ ...col, order: index + 1 })));
      toast({ title: "Ordre des colonnes mis à jour" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'ordre des colonnes",
        variant: "destructive",
      });
    }
  };

  const addColumn = async () => {
    if (!newColumnTitle.trim() || !user) return;
    
    const newStatus = `custom_${Date.now()}`;
    const maxOrder = Math.max(...columns.map(c => c.order), 0);
    
    const { data, error } = await supabase
      .from('user_columns')
      .insert([{
        user_id: user.id,
        title: newColumnTitle,
        status: newStatus,
        color: '#64748b',
        order: maxOrder + 1
      }])
      .select()
      .single();
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la colonne",
        variant: "destructive",
      });
    } else {
      setColumns(prev => [...prev, data]);
      setNewColumnTitle("");
      toast({ title: "Colonne ajoutée" });
    }
  };

  const deleteColumn = async (columnId: string) => {
    const { error } = await supabase
      .from('user_columns')
      .delete()
      .eq('id', columnId);
    
    if (error) {
      toast({
        title: "Erreur", 
        description: "Impossible de supprimer la colonne",
        variant: "destructive",
      });
    } else {
      setColumns(prev => prev.filter(col => col.id !== columnId));
      toast({ title: "Colonne supprimée" });
    }
  };

  const updateCustomFieldOrder = async (reorderedFields: CustomField[]) => {
    try {
      // Update each field's order in the database
      const updates = reorderedFields.map((field, index) => 
        supabase
          .from('user_custom_fields')
          .update({ order: index + 1 })
          .eq('id', field.id)
      );
      
      await Promise.all(updates);
      
      setCustomFields(reorderedFields.map((field, index) => ({ ...field, order: index + 1 })));
      toast({ title: "Ordre des champs mis à jour" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'ordre des champs",
        variant: "destructive",
      });
    }
  };

  const addCustomField = async () => {
    if (!newFieldName.trim() || !user) return;
    
    const maxOrder = Math.max(...customFields.map(f => f.order), 0);
    const options = newFieldType === 'select' 
      ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    
    const { data, error } = await supabase
      .from('user_custom_fields')
      .insert([{
        user_id: user.id,
        name: newFieldName,
        type: newFieldType,
        options: options,
        required: false,
        order: maxOrder + 1
      }])
      .select()
      .single();
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le champ",
        variant: "destructive",
      });
    } else {
      setCustomFields(prev => [...prev, {
        id: data.id,
        name: data.name,
        type: data.type as 'text' | 'number' | 'select' | 'date' | 'checkbox',
        options: options,
        required: data.required || false,
        order: data.order || 0
      }]);
      setNewFieldName("");
      setNewFieldType('text');
      setNewFieldOptions("");
      toast({ title: "Champ ajouté" });
    }
  };

  const updateCustomField = async (fieldId: string, updates: Partial<CustomField>) => {
    const { error } = await supabase
      .from('user_custom_fields')
      .update(updates)
      .eq('id', fieldId);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le champ",
        variant: "destructive",
      });
    } else {
      setCustomFields(prev => prev.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      ));
    }
  };

  const deleteCustomField = async (fieldId: string) => {
    const { error } = await supabase
      .from('user_custom_fields')
      .delete()
      .eq('id', fieldId);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le champ",
        variant: "destructive",
      });
    } else {
      setCustomFields(prev => prev.filter(field => field.id !== fieldId));
      toast({ title: "Champ supprimé" });
    }
  };

  const saveNotifications = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          notifications: notifications as any
        });
      
      if (error) throw error;
      
      toast({ title: "Préférences sauvegardées" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les préférences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">Personnalisez votre espace de travail</p>
        </div>
      </div>

      <Tabs defaultValue="columns" className="space-y-6">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`}>
          <TabsTrigger value="columns" className="flex items-center gap-2">
            <Columns className="w-4 h-4" />
            Colonnes
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Champs
          </TabsTrigger>
          <TabsTrigger value="cards" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Cartes
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profil
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Utilisateurs
            </TabsTrigger>
          )}
        </TabsList>

        {/* Colonnes Kanban */}
        <TabsContent value="columns">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Configuration des colonnes Kanban</CardTitle>
              <CardDescription>
                Personnalisez les colonnes de votre tableau Kanban. Glissez-déposez pour réorganiser l'ordre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DragDropList
                items={columns}
                onReorder={updateColumnOrder}
                renderItem={(column) => (
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Nom de la colonne</Label>
                      <Input 
                        value={column.title} 
                        className="mt-1"
                        onChange={(e) => updateColumn(column.id, { title: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">Couleur</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: column.color }}
                        />
                        <Input 
                          type="color" 
                          value={column.color} 
                          className="w-16 h-8 p-0 border-0"
                          onChange={(e) => updateColumn(column.id, { color: e.target.value })}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive ml-auto"
                          onClick={() => deleteColumn(column.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                itemClassName="p-4 bg-surface-variant rounded-lg"
              />
              
              <div className="flex gap-2">
                <Input 
                  placeholder="Nom de la nouvelle colonne"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                />
                <Button variant="outline" onClick={addColumn}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Champs personnalisés */}
        <TabsContent value="fields">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Champs de formulaire</CardTitle>
              <CardDescription>
                Champs système et personnalisés pour vos formulaires de tâches. Glissez-déposez pour réorganiser l'ordre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* System Fields */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Champs système</h4>
                <div className="space-y-3">
                  {systemFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <div>
                          <p className="font-medium">{field.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Type: {field.type} {field.required && '• Requis'} • Non modifiable
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        Système
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Management */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Catégories</h4>
                <div className="space-y-4">
                  <div className="p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium">Catégorie</p>
                        <p className="text-sm text-muted-foreground">
                          Type: select • Système • Vous pouvez modifier les options
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <Label className="text-sm">Options disponibles</Label>
                      
                      {/* Existing categories */}
                      {userCategories.length > 0 && (
                        <DragDropList
                          items={userCategories}
                          onReorder={reorderCategories}
                          renderItem={(category) => (
                            <div className="flex items-center gap-2">
                              <Input 
                                value={category.name} 
                                className="flex-1"
                                onChange={(e) => updateCategory(category.id, { name: e.target.value })}
                              />
                              <div 
                                className="w-8 h-8 rounded border"
                                style={{ backgroundColor: category.color }}
                              />
                              <Input 
                                type="color" 
                                value={category.color} 
                                className="w-12 h-8 p-0 border-0"
                                onChange={(e) => updateCategory(category.id, { color: e.target.value })}
                              />
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive"
                                onClick={() => deleteCategory(category.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          itemClassName="p-2 bg-background rounded border"
                        />
                      )}
                      
                      {/* Add new category */}
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Nouvelle catégorie"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={async () => {
                            if (newCategoryName.trim()) {
                              try {
                                await saveCategory({
                                  name: newCategoryName.trim(),
                                  color: '#64748b',
                                  order: userCategories.length + 1
                                });
                                setNewCategoryName("");
                                toast({ title: "Catégorie ajoutée" });
                              } catch (error) {
                                toast({
                                  title: "Erreur",
                                  description: "Impossible d'ajouter la catégorie",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Champs personnalisés</h4>
                {customFields.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>Aucun champ personnalisé configuré</p>
                  </div>
                ) : (
                  <DragDropList
                    items={customFields}
                    onReorder={updateCustomFieldOrder}
                    renderItem={(field) => (
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm">Nom du champ</Label>
                          <Input 
                            value={field.name} 
                            className="mt-1"
                            onChange={(e) => updateCustomField(field.id, { name: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <Label className="text-sm">Type</Label>
                          <Select 
                            value={field.type}
                            onValueChange={(value: any) => updateCustomField(field.id, { type: value })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Texte</SelectItem>
                              <SelectItem value="number">Nombre</SelectItem>
                              <SelectItem value="select">Liste déroulante</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="checkbox">Case à cocher</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-6">
                          <Switch 
                            id={`required-${field.id}`}
                            checked={field.required}
                            onCheckedChange={(checked) => updateCustomField(field.id, { required: checked })}
                          />
                          <Label htmlFor={`required-${field.id}`} className="text-sm">
                            Obligatoire
                          </Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive ml-auto"
                            onClick={() => deleteCustomField(field.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    itemClassName="p-4 bg-surface-variant rounded-lg"
                  />
                )}

                {/* Add new field */}
                <div className="grid grid-cols-4 gap-2 pt-4">
                  <Input 
                    placeholder="Nom du champ"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                  />
                  <Select value={newFieldType} onValueChange={(value: any) => setNewFieldType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texte</SelectItem>
                      <SelectItem value="number">Nombre</SelectItem>
                      <SelectItem value="select">Liste déroulante</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="checkbox">Case à cocher</SelectItem>
                    </SelectContent>
                  </Select>
                  {newFieldType === 'select' && (
                    <Input 
                      placeholder="Options (séparées par ,)"
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                    />
                  )}
                  <Button variant="outline" onClick={addCustomField}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                 </div>
               </div>
             </CardContent>
           </Card>
        </TabsContent>

        {/* Configuration des cartes Kanban */}
         <TabsContent value="cards">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Configuration des cartes Kanban</CardTitle>
              <CardDescription>
                Choisissez les informations à afficher sur les cartes de votre tableau Kanban
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Éléments à afficher sur les cartes</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Titre</Label>
                      <p className="text-xs text-muted-foreground">Titre principal de la tâche</p>
                    </div>
                    <Switch checked disabled />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Description</Label>
                      <p className="text-xs text-muted-foreground">Description courte de la tâche</p>
                    </div>
                    <Switch 
                      checked={kanbanPreferences?.visible_columns?.includes('description') ?? true}
                      onCheckedChange={(checked) => {
                        const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee', 'sipiNumber', 'companyName'];
                        const updated = checked 
                          ? [...current.filter(c => c !== 'description'), 'description']
                          : current.filter(c => c !== 'description');
                        saveKanbanPreferences({ visible_columns: updated });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Tags</Label>
                      <p className="text-xs text-muted-foreground">Étiquettes de la tâche</p>
                    </div>
                    <Switch 
                      checked={kanbanPreferences?.visible_columns?.includes('tags') ?? true}
                      onCheckedChange={(checked) => {
                        const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee', 'sipiNumber', 'companyName'];
                        const updated = checked 
                          ? [...current.filter(c => c !== 'tags'), 'tags']
                          : current.filter(c => c !== 'tags');
                        saveKanbanPreferences({ visible_columns: updated });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Priorité</Label>
                      <p className="text-xs text-muted-foreground">Niveau de priorité</p>
                    </div>
                    <Switch 
                      checked={kanbanPreferences?.visible_columns?.includes('priority') ?? true}
                      onCheckedChange={(checked) => {
                        const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee'];
                        const updated = checked 
                          ? [...current.filter(c => c !== 'priority'), 'priority']
                          : current.filter(c => c !== 'priority');
                        saveKanbanPreferences({ visible_columns: updated });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Date d'échéance</Label>
                      <p className="text-xs text-muted-foreground">Date limite de la tâche</p>
                    </div>
                    <Switch 
                      checked={kanbanPreferences?.visible_columns?.includes('dueDate') ?? true}
                      onCheckedChange={(checked) => {
                        const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee', 'sipiNumber', 'companyName'];
                        const updated = checked 
                          ? [...current.filter(c => c !== 'dueDate'), 'dueDate']
                          : current.filter(c => c !== 'dueDate');
                        saveKanbanPreferences({ visible_columns: updated });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Assigné à</Label>
                      <p className="text-xs text-muted-foreground">Personne responsable</p>
                    </div>
                    <Switch 
                      checked={kanbanPreferences?.visible_columns?.includes('assignee') ?? true}
                      onCheckedChange={(checked) => {
                        const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee', 'sipiNumber', 'companyName'];
                        const updated = checked 
                          ? [...current.filter(c => c !== 'assignee'), 'assignee']
                          : current.filter(c => c !== 'assignee');
                        saveKanbanPreferences({ visible_columns: updated });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Numéro SIPI</Label>
                      <p className="text-xs text-muted-foreground">Numéro d'identification de l'entreprise</p>
                    </div>
                    <Switch 
                      checked={kanbanPreferences?.visible_columns?.includes('sipiNumber') ?? true}
                      onCheckedChange={(checked) => {
                        const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee', 'sipiNumber', 'companyName'];
                        const updated = checked 
                          ? [...current.filter(c => c !== 'sipiNumber'), 'sipiNumber']
                          : current.filter(c => c !== 'sipiNumber');
                        saveKanbanPreferences({ visible_columns: updated });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Société</Label>
                      <p className="text-xs text-muted-foreground">Nom de l'entreprise</p>
                    </div>
                    <Switch 
                      checked={kanbanPreferences?.visible_columns?.includes('companyName') ?? true}
                      onCheckedChange={(checked) => {
                        const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee', 'sipiNumber', 'companyName'];
                        const updated = checked 
                          ? [...current.filter(c => c !== 'companyName'), 'companyName']
                          : current.filter(c => c !== 'companyName');
                        saveKanbanPreferences({ visible_columns: updated });
                      }}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3">Champs personnalisés</h4>
                  {customFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun champ personnalisé configuré</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {customFields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <Label>{field.name}</Label>
                            <p className="text-xs text-muted-foreground">Champ personnalisé {field.type}</p>
                          </div>
                          <Switch 
                            checked={kanbanPreferences?.visible_columns?.includes(`custom_field_${field.id}`) ?? false}
                            onCheckedChange={(checked) => {
                              const current = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee', 'sipiNumber', 'companyName'];
                              const fieldKey = `custom_field_${field.id}`;
                              const updated = checked 
                                ? [...current.filter(c => c !== fieldKey), fieldKey]
                                : current.filter(c => c !== fieldKey);
                              saveKanbanPreferences({ visible_columns: updated });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Préférences de notification</CardTitle>
              <CardDescription>
                Gérez vos notifications et rappels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications par email</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevez des notifications par email pour les tâches importantes
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.email}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications push</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevez des notifications push dans votre navigateur
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.push}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Résumé quotidien</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevez un résumé quotidien de vos tâches
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.dailyDigest}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, dailyDigest: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rappel avant échéance (jours)</Label>
                  <Select 
                    value={String(notifications.daysBeforeDue)}
                    onValueChange={(value) => setNotifications(prev => ({ ...prev, daysBeforeDue: parseInt(value) }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 jour</SelectItem>
                      <SelectItem value="2">2 jours</SelectItem>
                      <SelectItem value="3">3 jours</SelectItem>
                      <SelectItem value="7">1 semaine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={saveNotifications} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profil */}
        <TabsContent value="profile">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
              <CardDescription>
                Gérez vos informations personnelles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled />
              </div>

              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input placeholder="Votre nom complet" />
              </div>

              <Button>
                <Save className="w-4 h-4 mr-2" />
                Sauvegarder le profil
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gestion des utilisateurs (admin uniquement) */}
        {isAdmin && (
          <TabsContent value="users">
            <UserApprovalPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SettingsPage;