import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { User, Lock, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  // Profile data
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    avatar_url: ''
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Account deletion
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
        return;
      }

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          email: data.email || user.email || '',
          avatar_url: data.avatar_url || ''
        });
      } else {
        // Create profile if it doesn't exist
        setProfile({
          full_name: '',
          email: user.email || '',
          avatar_url: ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving profile:', error);
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder le profil.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Profil sauvegardé",
        description: "Vos informations ont été mises à jour."
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le profil.",
        variant: "destructive"
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Mots de passe différents",
        description: "Les nouveaux mots de passe ne correspondent pas.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive"
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Error changing password:', error);
        toast({
          title: "Erreur",
          description: "Impossible de changer le mot de passe.",
          variant: "destructive"
        });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été mis à jour avec succès."
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Erreur",
        description: "Impossible de changer le mot de passe.",
        variant: "destructive"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'SUPPRIMER') {
      toast({
        title: "Confirmation incorrecte",
        description: "Veuillez taper 'SUPPRIMER' pour confirmer.",
        variant: "destructive"
      });
      return;
    }

    if (!user) return;

    setIsDeletingAccount(true);
    try {
      // Delete all user data first
      await supabase.from('user_calendar_settings').delete().eq('user_id', user.id);
      await supabase.from('user_notifications').delete().eq('user_id', user.id);
      await supabase.from('user_view_preferences').delete().eq('user_id', user.id);
      await supabase.from('user_preferences').delete().eq('user_id', user.id);
      await supabase.from('user_custom_fields').delete().eq('user_id', user.id);
      await supabase.from('user_columns').delete().eq('user_id', user.id);
      await supabase.from('user_categories').delete().eq('user_id', user.id);
      await supabase.from('tasks').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);

      toast({
        title: "Compte supprimé",
        description: "Votre compte et toutes vos données ont été supprimés."
      });

      // Sign out and redirect
      await signOut();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le compte.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Profil</h2>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Profil</h2>
        <Badge variant="secondary" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          {user?.email}
        </Badge>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Informations du profil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informations personnelles
            </CardTitle>
            <CardDescription>
              Gérez vos informations de profil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nom complet</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Votre nom complet"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="votre.email@exemple.com"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être modifié depuis cette interface
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_url">URL de l'avatar (optionnel)</Label>
              <Input
                id="avatar_url"
                type="url"
                value={profile.avatar_url}
                onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                placeholder="https://exemple.com/avatar.jpg"
              />
            </div>

            <Button onClick={saveProfile} disabled={isSavingProfile} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {isSavingProfile ? "Sauvegarde..." : "Sauvegarder le profil"}
            </Button>
          </CardContent>
        </Card>

        {/* Changement de mot de passe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Changer le mot de passe
            </CardTitle>
            <CardDescription>
              Modifiez votre mot de passe pour sécuriser votre compte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe (min. 6 caractères)"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmer le nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez le nouveau mot de passe"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Button 
              onClick={changePassword} 
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              <Lock className="w-4 h-4 mr-2" />
              {isChangingPassword ? "Modification..." : "Changer le mot de passe"}
            </Button>
          </CardContent>
        </Card>

        {/* Zone dangereuse */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Zone dangereuse
            </CardTitle>
            <CardDescription>
              Actions irréversibles sur votre compte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            
            <div className="space-y-2">
              <h4 className="font-medium text-destructive">Supprimer le compte</h4>
              <p className="text-sm text-muted-foreground">
                Cette action supprimera définitivement votre compte et toutes vos données (tâches, catégories, paramètres, etc.). 
                Cette action ne peut pas être annulée.
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer mon compte
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      Cette action supprimera définitivement votre compte et toutes les données associées :
                    </p>
                    <ul className="list-disc list-inside text-xs space-y-1 ml-4">
                      <li>Toutes vos tâches</li>
                      <li>Vos catégories personnalisées</li>
                      <li>Vos paramètres de calendrier</li>
                      <li>Vos préférences et notifications</li>
                      <li>Votre profil utilisateur</li>
                      <li>Toutes autres données personnelles</li>
                    </ul>
                    <p className="font-medium text-destructive mt-4">
                      Cette action ne peut pas être annulée.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="delete_confirmation">
                      Pour confirmer, tapez <span className="font-mono font-bold">SUPPRIMER</span> dans le champ ci-dessous :
                    </Label>
                    <Input
                      id="delete_confirmation"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="SUPPRIMER"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteAccount}
                    disabled={isDeletingAccount || deleteConfirmation !== 'SUPPRIMER'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeletingAccount ? "Suppression..." : "Supprimer définitivement"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}