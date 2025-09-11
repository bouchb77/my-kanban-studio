import { Bell, Check, Clock, AlertCircle, CheckCircle, Calendar, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const NotificationsPage = () => {
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_due':
      case 'task_overdue':
        return Clock;
      case 'task_completed':
        return CheckCircle;
      case 'task_assigned':
        return AlertCircle;
      case 'project_comment':
        return MessageSquare;
      default:
        return Bell;
    }
  };

  const getNotificationVariant = (type: string) => {
    switch (type) {
      case 'task_overdue':
        return 'destructive' as const;
      case 'task_completed':
        return 'secondary' as const;
      case 'project_comment':
        return 'outline' as const;
      default:
        return 'default' as const;
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Restez informé de vos tâches et échéances
          </p>
        </div>
        <Button variant="outline" onClick={markAllAsRead}>
          <Check className="w-4 h-4 mr-2" />
          Tout marquer comme lu
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const IconComponent = getNotificationIcon(notification.type);
            const variant = getNotificationVariant(notification.type);
            
            return (
              <Card 
                key={notification.id} 
                className={`transition-all hover:shadow-md cursor-pointer ${
                  !notification.read ? 'bg-accent/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${
                      variant === 'destructive' 
                        ? 'bg-destructive/10 text-destructive' 
                        : variant === 'secondary'
                        ? 'bg-secondary text-secondary-foreground'
                        : variant === 'outline'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{notification.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { 
                              addSuffix: true, 
                              locale: fr 
                            })}
                          </span>
                          {!notification.read && (
                            <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {notifications.length === 0 && !loading && (
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