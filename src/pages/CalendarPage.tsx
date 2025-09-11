import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Users, Link, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  categories?: string[];
}

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [icsUrl, setIcsUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.start.dateTime), date)
    );
  };

  const getEventsForSelectedDate = () => {
    return getEventsForDate(selectedDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const renderCalendarGrid = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add days from previous month to fill the first week
    const startDay = monthStart.getDay();
    const prevDays = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const day = new Date(monthStart);
      day.setDate(day.getDate() - i - 1);
      prevDays.push(day);
    }
    
    // Add days from next month to fill the last week
    const endDay = monthEnd.getDay();
    const nextDays = [];
    for (let i = 1; i <= (6 - endDay); i++) {
      const day = new Date(monthEnd);
      day.setDate(day.getDate() + i);
      nextDays.push(day);
    }
    
    const allDays = [...prevDays, ...days, ...nextDays];
    
    return (
      <div className="grid grid-cols-7 gap-px bg-border">
        {/* Header row with day names */}
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
          <div key={day} className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {allDays.map((day, index) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          
          return (
            <div
              key={index}
              className={cn(
                "bg-background p-1 min-h-[100px] cursor-pointer hover:bg-muted/50 transition-colors",
                !isCurrentMonth && "opacity-50",
                isToday && "bg-accent",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedDate(day)}
            >
              <div className={cn(
                "text-sm font-medium mb-1",
                isToday && "text-primary font-bold"
              )}>
                {day.getDate()}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    className="text-xs p-1 bg-primary/10 text-primary rounded truncate space-y-1"
                    title={`${event.subject} ${event.categories?.length ? '- ' + event.categories.join(', ') : ''}`}
                  >
                    <div className="font-medium">
                      {format(new Date(event.start.dateTime), 'HH:mm', { locale: fr })} {event.subject}
                    </div>
                    {event.categories && event.categories.length > 0 && (
                      <div className="text-[10px] opacity-75 truncate">
                        {event.categories.slice(0, 2).join(', ')}
                        {event.categories.length > 2 && '...'}
                      </div>
                    )}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayEvents.length - 3} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendrier principal */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {format(currentDate, 'MMMM yyyy', { locale: fr })}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Aujourd'hui
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {renderCalendarGrid()}
            </CardContent>
          </Card>
        </div>

        {/* Détails du jour sélectionné */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getEventsForSelectedDate().length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucun événement ce jour</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getEventsForSelectedDate().map((event, index) => {
                    const startDateTime = formatDateTime(event.start.dateTime);
                    const endDateTime = formatDateTime(event.end.dateTime);

                    return (
                      <div key={index} className="border rounded-lg p-3 space-y-2">
                        <h4 className="font-medium text-sm">{event.subject}</h4>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          {startDateTime.time} - {endDateTime.time}
                        </div>
                        {event.location && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <MapPin className="mr-1 h-3 w-3" />
                            {event.location.displayName}
                          </div>
                        )}
                        {event.bodyPreview && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {event.bodyPreview}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Résumé des événements du mois */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ce mois-ci</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total d'événements:</span>
                  <Badge variant="secondary">{events.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Événements aujourd'hui:</span>
                  <Badge variant="secondary">
                    {getEventsForDate(new Date()).length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}