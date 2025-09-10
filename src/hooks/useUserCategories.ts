import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  order: number;
}

export const useUserCategories = () => {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadCategories = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .order('order');
      
      if (error) {
        console.error('Error loading categories:', error);
        return;
      }
      
      if (data) {
        setCategories(data.map(cat => ({
          id: cat.id,
          user_id: cat.user_id,
          name: cat.name,
          color: cat.color,
          order: cat.order
        })));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCategory = async (categoryData: Pick<UserCategory, 'name' | 'color' | 'order'>) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_categories')
        .insert({
          user_id: user.id,
          name: categoryData.name,
          color: categoryData.color,
          order: categoryData.order,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving category:', error);
        throw error;
      }
      
      if (data) {
        const newCategory = {
          id: data.id,
          user_id: data.user_id,
          name: data.name,
          color: data.color,
          order: data.order
        };
        setCategories(prev => [...prev, newCategory]);
      }
    } catch (error) {
      console.error('Error saving category:', error);
      throw error;
    }
  };

  const updateCategory = async (categoryId: string, updates: Partial<Pick<UserCategory, 'name' | 'color' | 'order'>>) => {
    try {
      const { error } = await supabase
        .from('user_categories')
        .update(updates)
        .eq('id', categoryId);
      
      if (error) {
        console.error('Error updating category:', error);
        throw error;
      }
      
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, ...updates } : cat
      ));
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('id', categoryId);
      
      if (error) {
        console.error('Error deleting category:', error);
        throw error;
      }
      
      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  };

  const reorderCategories = async (newOrder: UserCategory[]) => {
    try {
      const updates = newOrder.map((category, index) => 
        supabase
          .from('user_categories')
          .update({ order: index + 1 })
          .eq('id', category.id)
      );
      
      await Promise.all(updates);
      
      setCategories(newOrder.map((cat, index) => ({ ...cat, order: index + 1 })));
    } catch (error) {
      console.error('Error reordering categories:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadCategories();
  }, [user]);

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_categories',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { 
    categories, 
    loading, 
    saveCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    refetch: loadCategories 
  };
};