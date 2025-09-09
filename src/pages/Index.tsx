import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // For now, redirect to login. In a real app, check auth state
    navigate("/login");
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--gradient-surface)" }}>
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
};

export default Index;
