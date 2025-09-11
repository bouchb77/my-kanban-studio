import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, Mail, Lock, User, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", password: "", fullName: "" });
  const [error, setError] = useState("");
  
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!loginData.email || !loginData.password) {
      setError("Veuillez remplir tous les champs");
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(loginData.email, loginData.password);
    
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setError("Email ou mot de passe incorrect");
      } else if (error.message.includes("Email not confirmed")) {
        setError("Veuillez confirmer votre email avant de vous connecter");
      } else {
        setError("Erreur de connexion. Veuillez réessayer.");
      }
      setIsLoading(false);
    } else {
      // Success handled by AuthContext
      navigate("/dashboard", { replace: true });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!registerData.email || !registerData.password || !registerData.fullName) {
      setError("Veuillez remplir tous les champs");
      setIsLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(registerData.email, registerData.password, registerData.fullName);
    
    if (error) {
      if (error.message.includes("User already registered")) {
        setError("Un compte avec cet email existe déjà");
      } else if (error.message.includes("Password should be")) {
        setError("Le mot de passe doit contenir au moins 6 caractères");
      } else {
        setError("Erreur lors de l'inscription. Veuillez réessayer.");
      }
      setIsLoading(false);
    } else {
      toast({
        title: "Compte créé !",
        description: "Vérifiez votre email pour confirmer votre compte, puis connectez-vous.",
      });
      setRegisterData({ email: "", password: "", fullName: "" });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-surface)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-white">
            <img src="/lovable-uploads/ada61702-74b1-4eb4-b110-1b1f2897a2d4.png" alt="TaskFlow Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">TaskFlow</h1>
          <p className="text-muted-foreground mt-2">Gérez vos tâches efficacement</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Authentification</CardTitle>
            <CardDescription>
              Connectez-vous ou créez un compte pour commencer
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md mb-4">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="register">Inscription</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="votre@email.com"
                        className="pl-10"
                        value={loginData.email}
                        onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    style={{ background: "var(--gradient-primary)" }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nom complet</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Votre nom complet"
                        className="pl-10"
                        value={registerData.fullName}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, fullName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-register">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-register"
                        type="email"
                        placeholder="votre@email.com"
                        className="pl-10"
                        value={registerData.email}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-register">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password-register"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={registerData.password}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Au moins 6 caractères</p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    style={{ background: "var(--gradient-primary)" }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Création..." : "Créer un compte"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <p className="text-center text-sm text-muted-foreground mt-6">
          En vous connectant, vous acceptez nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;