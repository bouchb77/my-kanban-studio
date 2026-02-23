import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';

interface UserRoleData {
  user_id: string;
  role: 'admin' | 'bo' | 'ct' | 'fo' | 'de';
  formateur?: string;
}

export const UserRoleManager = () => {
  const { users, loading: usersLoading } = useUsers();
  const { toast } = useToast();
  const [userRoles, setUserRoles] = useState<UserRoleData[]>([]);
  const [formateurList, setFormateurList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserRoles();
    loadFormateurList();
  }, []);

  const loadFormateurList = async () => {
    const { data } = await supabase
      .from('department_management')
      .select('formateur')
      .order('formateur');

    if (data) {
      const uniqueFormateurs = Array.from(new Set(data.map(d => d.formateur).filter(Boolean))) as string[];
      setFormateurList(uniqueFormateurs);
    }
  };

  const loadUserRoles = async () => {
    setLoading(true);
    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const { data: sectorsData } = await supabase
        .from('user_fo_sectors')
        .select('user_id, formateur');

      const roles: UserRoleData[] = [];
      
      rolesData?.forEach((roleItem) => {
        const sector = sectorsData?.find(s => s.user_id === roleItem.user_id);
        roles.push({
          user_id: roleItem.user_id,
          role: roleItem.role as any,
          formateur: sector?.formateur
        });
      });

      setUserRoles(roles);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Insert new role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole as any }]);

      if (roleError) throw roleError;

      // If role is not FO, delete FO sector
      if (newRole !== 'fo') {
        await supabase
          .from('user_fo_sectors')
          .delete()
          .eq('user_id', userId);
      }

      toast({
        title: "Rôle mis à jour",
        description: "Le rôle de l'utilisateur a été modifié avec succès."
      });

      loadUserRoles();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le rôle.",
        variant: "destructive"
      });
    }
  };

  const updateUserSector = async (userId: string, formateur: string) => {
    try {
      const { error } = await supabase
        .from('user_fo_sectors')
        .upsert({ user_id: userId, formateur });

      if (error) throw error;

      toast({
        title: "Secteur mis à jour",
        description: "Le secteur FO a été affecté avec succès."
      });

      loadUserRoles();
    } catch (error) {
      console.error('Error updating sector:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le secteur.",
        variant: "destructive"
      });
    }
  };

  if (usersLoading || loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion des Rôles</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => {
            const userRole = userRoles.find(r => r.user_id === user.id);
            const currentRole = userRole?.role;
            const currentFormateur = userRole?.formateur;

            return (
              <div key={user.id} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{user.full_name || user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Rôle:</Label>
                  <Select
                    value={currentRole || 'none'}
                    onValueChange={(value) => value !== 'none' && updateUserRole(user.id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="bo">BO</SelectItem>
                      <SelectItem value="ct">CT</SelectItem>
                      <SelectItem value="fo">FO</SelectItem>
                      <SelectItem value="de">DE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {currentRole === 'fo' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Secteur:</Label>
                    <Select
                      value={currentFormateur || 'none'}
                      onValueChange={(value) => value !== 'none' && updateUserSector(user.id, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non affecté</SelectItem>
                        {formateurList.map((formateur) => (
                          <SelectItem key={formateur} value={formateur}>
                            {formateur}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
