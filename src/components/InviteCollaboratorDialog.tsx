import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectCollaborators } from '@/hooks/useProjects';
import { useUsers } from '@/hooks/useUsers';

interface InviteCollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export const InviteCollaboratorDialog: React.FC<InviteCollaboratorDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  onSuccess
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const { inviteCollaborator, collaborators } = useProjectCollaborators(projectId);
  const { users, loading } = useUsers();

  // Filter out users who are already collaborators
  const availableUsers = users.filter(user => 
    !collaborators.some(collaborator => collaborator.user_id === user.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    const selectedUser = availableUsers.find(u => u.id === selectedUserId);
    if (!selectedUser) return;

    try {
      await inviteCollaborator(selectedUser.email, role);
      setSelectedUserId('');
      setRole('member');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error inviting collaborator:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Inviter un collaborateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="user">Utilisateur</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un utilisateur" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Aucun utilisateur disponible à inviter
                  </div>
                ) : (
                  availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                      {user.full_name && <span className="text-muted-foreground ml-2">({user.email})</span>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="role">Rôle</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualiseur</SelectItem>
                <SelectItem value="member">Membre</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!selectedUserId || availableUsers.length === 0}>
              Inviter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};