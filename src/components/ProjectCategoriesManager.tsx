import React, { useState } from 'react';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DragDropList } from '@/components/DragDropList';
import { useProjectCategories } from '@/hooks/useProjectCategories';

interface ProjectCategoriesManagerProps {
  projectId: string;
}

const CreateCategoryDialog: React.FC<{ 
  projectId: string; 
  onSuccess: () => void 
}> = ({ projectId, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#64748b');
  const { createCategory } = useProjectCategories(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const category = await createCategory(name.trim(), color);
    if (category) {
      setOpen(false);
      setName('');
      setColor('#64748b');
      onSuccess();
    }
  };

  const predefinedColors = [
    '#64748b', '#ef4444', '#f97316', '#eab308', 
    '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle catégorie
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle catégorie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom de la catégorie</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ma nouvelle catégorie"
              required
            />
          </div>
          
          <div>
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {predefinedColors.map((predefinedColor) => (
                <button
                  key={predefinedColor}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 ${
                    color === predefinedColor ? 'border-gray-900' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: predefinedColor }}
                  onClick={() => setColor(predefinedColor)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-2 h-10"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EditCategoryDialog: React.FC<{ 
  category: { id: string; name: string; color: string };
  projectId: string;
  onSuccess: () => void 
}> = ({ category, projectId, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const { updateCategory } = useProjectCategories(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await updateCategory(category.id, { name: name.trim(), color });
    setOpen(false);
    onSuccess();
  };

  const predefinedColors = [
    '#64748b', '#ef4444', '#f97316', '#eab308', 
    '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Modifier la catégorie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom de la catégorie</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ma catégorie"
              required
            />
          </div>
          
          <div>
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {predefinedColors.map((predefinedColor) => (
                <button
                  key={predefinedColor}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 ${
                    color === predefinedColor ? 'border-gray-900' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: predefinedColor }}
                  onClick={() => setColor(predefinedColor)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-2 h-10"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Mettre à jour</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const ProjectCategoriesManager: React.FC<ProjectCategoriesManagerProps> = ({ projectId }) => {
  const { categories, loading, deleteCategory, reorderCategories, refetch } = useProjectCategories(projectId);

  const handleDeleteCategory = async (categoryId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      await deleteCategory(categoryId);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Catégories du projet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Chargement des catégories...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Catégories du projet</CardTitle>
          <CreateCategoryDialog projectId={projectId} onSuccess={refetch} />
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune catégorie créée. Créez votre première catégorie pour organiser vos tâches.
          </div>
        ) : (
          <DragDropList
            items={categories.map(cat => ({ ...cat, order: cat.order_index }))}
            onReorder={(newOrder) => reorderCategories(newOrder.map(item => ({ ...item, order_index: item.order })))}
            renderItem={(category) => (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  <Badge 
                    style={{ backgroundColor: category.color, color: 'white' }}
                    className="border-none"
                  >
                    {category.name}
                  </Badge>
                </div>
                <div className="flex space-x-1">
                  <EditCategoryDialog 
                    category={{ id: category.id, name: category.name, color: category.color }} 
                    projectId={projectId} 
                    onSuccess={refetch} 
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteCategory(category.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
};