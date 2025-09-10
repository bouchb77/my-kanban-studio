import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  bodyPreview?: string;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
}

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Simuler une vérification d'authentification
    const checkAuth = () => {
      // Pour le moment, on simule que l'utilisateur n'est pas connecté à Outlook
      setIsAuthenticated(false);
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleConnectOutlook = async () => {
    toast({
      title: "Connexion Outlook",
      description: "La connexion à Outlook sera bientôt disponible. En attendant, vous pouvez utiliser les autres fonctionnalités de l'application.",
    });
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Agenda Outlook</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Agenda Outlook</h2>
        </div>

        <Card className="mx-auto max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Connectez votre agenda Outlook</CardTitle>
            <CardDescription>
              Synchronisez vos événements Outlook pour une gestion centralisée de vos tâches et rendez-vous.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={handleConnectOutlook} className="w-full">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Connecter Outlook
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              Vos données restent sécurisées et privées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Fonctionnalités de l'agenda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">📅 Synchronisation automatique</h4>
                <p className="text-sm text-muted-foreground">
                  Vos événements Outlook apparaîtront automatiquement dans l'application
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">🔔 Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Recevez des rappels pour vos rendez-vous importants
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">🤝 Intégration avec les tâches</h4>
                <p className="text-sm text-muted-foreground">
                  Liez vos tâches Kanban à vos événements de calendrier
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">👥 Collaboration</h4>
                <p className="text-sm text-muted-foreground">
                  Partagez vos disponibilités avec votre équipe
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Agenda Outlook</h2>
        <div className="flex items-center space-x-2">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau rendez-vous
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun événement aujourd'hui</h3>
              <p className="text-muted-foreground text-center">
                Vos événements Outlook apparaîtront ici une fois synchronisés.
              </p>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => {
            const startDateTime = formatDateTime(event.start.dateTime);
            const endDateTime = formatDateTime(event.end.dateTime);

            return (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{event.subject}</CardTitle>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {startDateTime.time} - {endDateTime.time}
                        </div>
                        {event.location && (
                          <div className="flex items-center">
                            <MapPin className="mr-1 h-3 w-3" />
                            {event.location.displayName}
                          </div>
                        )}
                      </div>
                    </div>
                    {event.isOnlineMeeting && (
                      <Badge variant="secondary">En ligne</Badge>
                    )}
                  </div>
                </CardHeader>
                {(event.bodyPreview || event.attendees) && (
                  <CardContent>
                    {event.bodyPreview && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {event.bodyPreview}
                      </p>
                    )}
                    {event.attendees && event.attendees.length > 0 && (
                      <>
                        <Separator className="mb-3" />
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </>
                    )}
                    {event.onlineMeetingUrl && (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" asChild>
                          <a href={event.onlineMeetingUrl} target="_blank" rel="noopener noreferrer">
                            Rejoindre la réunion
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}