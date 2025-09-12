import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ProjectCategory {
  id: string;
  project_id: string;
  name: string;
  color: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const useProjectCategories = (projectId: string) => {
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadCategories = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('project_categories')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error loading categories:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (name: string, color: string = '#64748b') => {
    if (!user || !projectId) return null;

    try {
      const maxOrder = Math.max(...categories.map(c => c.order_index), -1);
      
      const { data, error } = await supabase
        .from('project_categories')
        .insert({
          project_id: projectId,
          name,
          color,
          order_index: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      const newCategory = data as ProjectCategory;
      setCategories(prev => [...prev, newCategory]);
      
      toast({
        title: "Succès",
        description: "Catégorie créée",
      });

      return newCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la catégorie",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCategory = async (categoryId: string, updates: Partial<Pick<ProjectCategory, 'name' | 'color'>>) => {
    try {
      const { error } = await supabase
        .from('project_categories')
        .update(updates)
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, ...updates } : cat
      ));

      toast({
        title: "Succès",
        description: "Catégorie mise à jour",
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la catégorie",
        variant: "destructive",
      });
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('project_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      
      toast({
        title: "Succès",
        description: "Catégorie supprimée",
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la catégorie",
        variant: "destructive",
      });
    }
  };

  const reorderCategories = async (newOrder: ProjectCategory[]) => {
    try {
      const updates = newOrder.map((category, index) => 
        supabase
          .from('project_categories')
          .update({ order_index: index })
          .eq('id', category.id)
      );

      await Promise.all(updates);
      
      setCategories(newOrder.map((cat, index) => ({ ...cat, order_index: index })));
    } catch (error) {
      console.error('Error reordering categories:', error);
      toast({
        title: "Erreur",
        description: "Impossible de réorganiser les catégories",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadCategories();
  }, [projectId]);

  // Set up real-time updates
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel('project-categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_categories',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    refetch: loadCategories
  };
};