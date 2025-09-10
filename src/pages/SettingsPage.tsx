import { useState } from "react";
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
  Palette, 
  User, 
  Plus, 
  Trash2,
  Edit,
  GripVertical
} from "lucide-react";
import { Column, CustomField } from "@/types/task";

const SettingsPage = () => {
  const [columns, setColumns] = useState<Column[]>([
    { id: "1", title: "À faire", status: "todo", order: 1, color: "#94a3b8" },
    { id: "2", title: "En cours", status: "in-progress", order: 2, color: "#3b82f6" },
    { id: "3", title: "En révision", status: "review", order: 3, color: "#eab308" },
    { id: "4", title: "Terminé", status: "done", order: 4, color: "#22c55e" },
  ]);

  const [customFields, setCustomFields] = useState<CustomField[]>([
    { id: "1", name: "Client", type: "text", required: false },
    { id: "2", name: "Budget", type: "number", required: false },
    { id: "3", name: "Type de projet", type: "select", options: ["Web", "Mobile", "Design"], required: true },
  ]);

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    daysBeforeDue: 3,
    dailyDigest: false,
  });

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
              {columns.map((column, index) => (
                <div key={column.id} className="flex items-center gap-4 p-4 bg-surface-variant rounded-lg">
                  <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                  
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm">Nom de la colonne</Label>
                      <Input value={column.title} className="mt-1" />
                    </div>
                    
                    <div>
                      <Label className="text-sm">Statut</Label>
                      <Select value={column.status}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">À faire</SelectItem>
                          <SelectItem value="in-progress">En cours</SelectItem>
                          <SelectItem value="review">En révision</SelectItem>
                          <SelectItem value="done">Terminé</SelectItem>
                        </SelectContent>
                      </Select>
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
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => console.log('Ajouter une colonne')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une colonne
              </Button>
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
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm">Nom du champ</Label>
                      <Input value={field.name} className="mt-1" />
                    </div>
                    
                    <div>
                      <Label className="text-sm">Type</Label>
                      <Select value={field.type}>
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
                    
                    {field.type === "select" && (
                      <div>
                        <Label className="text-sm">Options</Label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {field.options?.map((option, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {option}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id={`required-${field.id}`}
                        checked={field.required}
                      />
                      <Label htmlFor={`required-${field.id}`} className="text-sm">
                        Obligatoire
                      </Label>
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => console.log('Ajouter un champ')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un champ
              </Button>
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
                  <Label>Prénom</Label>
                  <Input placeholder="Votre prénom" className="mt-1" />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input placeholder="Votre nom" className="mt-1" />
                </div>
              </div>
              
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="votre@email.com" className="mt-1" />
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
                <Button style={{ background: "var(--gradient-primary)" }} className="border-0 text-primary-foreground">
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