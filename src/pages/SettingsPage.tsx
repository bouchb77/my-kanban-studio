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
  GripVertical,
  Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="columns" className="flex items-center gap-2">
            <Columns className="w-4 h-4" />
            Colonnes
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Champs
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profil
          </TabsTrigger>
        </TabsList>

        {/* Colonnes Kanban */}
        <TabsContent value="columns">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Configuration des colonnes Kanban</CardTitle>
              <CardDescription>
                Personnalisez les colonnes de votre tableau Kanban
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {columns.map((column) => (
                <div key={column.id} className="flex items-center gap-4 p-4 bg-surface-variant rounded-lg">
                  <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                  
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
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => deleteColumn(column.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
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
              <CardTitle>Champs personnalisés</CardTitle>
              <CardDescription>
                Définissez des champs supplémentaires pour vos tâches
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customFields.map((field) => (
                <div key={field.id} className="flex items-center gap-4 p-4 bg-surface-variant rounded-lg">
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
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => deleteCustomField(field.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <div className="grid grid-cols-12 gap-2">
                <Input 
                  className="col-span-4"
                  placeholder="Nom du champ"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                />
                <Select 
                  value={newFieldType}
                  onValueChange={(value) => setNewFieldType(value as 'text' | 'number' | 'select' | 'date' | 'checkbox')}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texte</SelectItem>
                    <SelectItem value="number">Nombre</SelectItem>
                    <SelectItem value="select">Liste</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="checkbox">Case</SelectItem>
                  </SelectContent>
                </Select>
                {newFieldType === 'select' && (
                  <Input 
                    className="col-span-3"
                    placeholder="Options (séparées par virgules)"
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                  />
                )}
                <Button 
                  variant="outline" 
                  className={newFieldType === 'select' ? "col-span-2" : "col-span-5"}
                  onClick={addCustomField}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter
                </Button>
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
                Configurez comment vous souhaitez être notifié
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Notifications par email</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir les notifications importantes par email
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.email}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, email: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Notifications push</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir des notifications dans le navigateur
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.push}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, push: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Rappel avant échéance</Label>
                  <Select 
                    value={notifications.daysBeforeDue.toString()}
                    onValueChange={(value) => 
                      setNotifications(prev => ({ ...prev, daysBeforeDue: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 jour avant</SelectItem>
                      <SelectItem value="2">2 jours avant</SelectItem>
                      <SelectItem value="3">3 jours avant</SelectItem>
                      <SelectItem value="7">1 semaine avant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Résumé quotidien</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un résumé de vos tâches chaque matin
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.dailyDigest}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, dailyDigest: checked }))
                    }
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <Button 
                  onClick={saveNotifications}
                  disabled={saving}
                  style={{ background: "var(--gradient-primary)" }} 
                  className="border-0 text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled className="mt-1" />
                </div>
                <div>
                  <Label>Nom complet</Label>
                  <Input placeholder="Votre nom complet" className="mt-1" />
                </div>
              </div>
              
              <div>
                <Label>Fuseau horaire</Label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner un fuseau horaire" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="europe/paris">Europe/Paris (UTC+1)</SelectItem>
                    <SelectItem value="europe/london">Europe/London (UTC+0)</SelectItem>
                    <SelectItem value="america/new_york">America/New_York (UTC-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="pt-4">
                <Button 
                  style={{ background: "var(--gradient-primary)" }} 
                  className="border-0 text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder les modifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;