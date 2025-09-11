import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Users, Link, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [icsUrl, setIcsUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Load saved ICS URL on component mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('outlook-ics-url');
    const savedEvents = localStorage.getItem('outlook-events');
    
    if (savedUrl) {
      setIcsUrl(savedUrl);
      setIsConnected(true);
      
      if (savedEvents) {
        try {
          setEvents(JSON.parse(savedEvents));
        } catch (error) {
          console.error('Error parsing saved events:', error);
        }
      }
    }
  }, []);

  const syncCalendar = async () => {
    if (!icsUrl.trim()) {
      toast({
        title: "URL requise",
        description: "Veuillez saisir l'URL de votre flux ICS Outlook.",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ics-sync', {
        body: { icsUrl: icsUrl.trim() }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.events) {
        setEvents(data.events);
        setIsConnected(true);
        
        // Save to localStorage
        localStorage.setItem('outlook-ics-url', icsUrl.trim());
        localStorage.setItem('outlook-events', JSON.stringify(data.events));
        
        toast({
          title: "Synchronisation réussie",
          description: `${data.events.length} événement(s) synchronisé(s)`,
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Erreur de synchronisation",
        description: "Impossible de récupérer les données du calendrier. Vérifiez l'URL ICS.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setEvents([]);
    setIcsUrl("");
    localStorage.removeItem('outlook-ics-url');
    localStorage.removeItem('outlook-events');
    
    toast({
      title: "Connexion fermée",
      description: "Votre calendrier Outlook a été déconnecté.",
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

  if (!isConnected) {
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
            <CardTitle>Connectez votre calendrier Outlook</CardTitle>
            <CardDescription>
              Synchronisez vos événements via le flux ICS de votre calendrier Outlook.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ics-url">URL du flux ICS Outlook</Label>
              <Input
                id="ics-url"
                type="url"
                placeholder="webcal://outlook.live.com/owa/calendar/..."
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Trouvez cette URL dans Outlook → Paramètres → Calendrier → Calendriers partagés → Publier un calendrier
              </p>
            </div>
            <Button 
              onClick={syncCalendar} 
              className="w-full"
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Connecter le calendrier
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Comment obtenir l'URL ICS ?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div>
                <strong>1. Outlook Web (outlook.live.com) :</strong>
                <p className="text-muted-foreground ml-4">
                  Paramètres → Calendrier → Calendriers partagés → Publier un calendrier → Copiez l'URL ICS
                </p>
              </div>
              <div>
                <strong>2. Outlook Desktop :</strong>
                <p className="text-muted-foreground ml-4">
                  Fichier → Paramètres du compte → Paramètres du compte → Onglet Internet Calendars
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs">
                  💡 <strong>Astuce :</strong> L'URL commence généralement par "webcal://" ou "https://" 
                  et contient "outlook.live.com" ou votre domaine d'entreprise.
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
          <Button 
            size="sm" 
            variant="outline"
            onClick={syncCalendar}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Synchronisation...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualiser
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDisconnect}>
            Déconnecter
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link className="h-4 w-4" />
              <span>Connecté au flux:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {icsUrl.length > 50 ? `${icsUrl.substring(0, 50)}...` : icsUrl}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun événement à venir</h3>
              <p className="text-muted-foreground text-center">
                Aucun événement trouvé dans les 30 prochains jours.
              </p>
              <Button 
                className="mt-4" 
                variant="outline" 
                onClick={syncCalendar}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Actualisation...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualiser le calendrier
                  </>
                )}
              </Button>
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
                  </div>
                </CardHeader>
                {event.bodyPreview && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {event.bodyPreview}
                    </p>
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