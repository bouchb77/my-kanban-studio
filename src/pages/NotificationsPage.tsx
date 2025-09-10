import { Bell, Check, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const NotificationsPage = () => {
  const notifications = [
    {
      id: 1,
      type: 'task',
      title: 'Nouvelle tâche assignée',
      description: 'Une nouvelle tâche vous a été assignée: "Révision du rapport"',
      time: '5 minutes',
      read: false,
      icon: AlertCircle,
      variant: 'default' as const
    },
    {
      id: 2,
      type: 'deadline',
      title: 'Échéance approche',
      description: 'La tâche "Présentation client" est due demain',
      time: '2 heures',
      read: false,
      icon: Clock,
      variant: 'destructive' as const
    },
    {
      id: 3,
      type: 'completed',
      title: 'Tâche terminée',
      description: 'La tâche "Analyse des données" a été marquée comme terminée',
      time: '1 jour',
      read: true,
      icon: Check,
      variant: 'secondary' as const
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Restez informé de vos tâches et échéances
          </p>
        </div>
        <Button variant="outline">
          <Check className="w-4 h-4 mr-2" />
          Tout marquer comme lu
        </Button>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => {
          const IconComponent = notification.icon;
          return (
            <Card 
              key={notification.id} 
              className={`transition-all hover:shadow-md cursor-pointer ${
                !notification.read ? 'bg-accent/50' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${
                    notification.variant === 'destructive' 
                      ? 'bg-destructive/10 text-destructive' 
                      : notification.variant === 'secondary'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{notification.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          il y a {notification.time}
                        </span>
                        {!notification.read && (
                          <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {notifications.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="mb-2">Aucune notification</CardTitle>
            <CardDescription>
              Vous êtes à jour ! Aucune nouvelle notification pour le moment.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationsPage;