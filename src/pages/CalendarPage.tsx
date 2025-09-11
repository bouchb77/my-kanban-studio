import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Users, Link, RefreshCw, ChevronLeft, ChevronRight, Save, Loader2 } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";

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
  const [isSaving, setIsSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { user } = useAuth();

  // Load saved calendar URL on component mount and auto-sync
  useEffect(() => {
    const loadSavedCalendarUrl = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_calendar_settings')
          .select('ics_url')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading calendar settings:', error);
          return;
        }

        if (data?.ics_url) {
          setIcsUrl(data.ics_url);
          setIsConnected(true);
          // Auto-sync when loading the page
          await syncCalendarWithUrl(data.ics_url);
        }
      } catch (error) {
        console.error('Error loading calendar settings:', error);
      }
    };

    loadSavedCalendarUrl();
  }, [user]);

  const saveUserCalendarSettings = async (url: string) => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_calendar_settings')
        .upsert({
          user_id: user.id,
          ics_url: url
        });

      if (error) {
        console.error('Error saving calendar settings:', error);
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder l'URL du calendrier.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Sauvegardé",
        description: "L'URL du calendrier a été sauvegardée.",
      });
    } catch (error) {
      console.error('Error saving calendar settings:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder l'URL du calendrier.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const syncCalendarWithUrl = async (url: string) => {
    setIsSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ics-sync', {
        body: { icsUrl: url }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.events) {
        setEvents(data.events);
        setIsConnected(true);
        
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

  const syncCalendar = async () => {
    if (!icsUrl.trim()) {
      toast({
        title: "URL requise",
        description: "Veuillez saisir l'URL de votre flux ICS Outlook.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Vous devez être connecté pour sauvegarder vos paramètres.",
        variant: "destructive"
      });
      return;
    }

    const trimmedUrl = icsUrl.trim();
    await saveUserCalendarSettings(trimmedUrl);
    await syncCalendarWithUrl(trimmedUrl);
  };

  const refreshCalendar = async () => {
    if (!icsUrl.trim()) return;
    await syncCalendarWithUrl(icsUrl.trim());
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_calendar_settings')
        .delete()
        .eq('user_id', user.id);

      setIsConnected(false);
      setEvents([]);
      setIcsUrl("");
      
      toast({
        title: "Connexion fermée",
        description: "Votre calendrier Outlook a été déconnecté.",
      });
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: "Erreur",
        description: "Impossible de déconnecter le calendrier.",
        variant: "destructive"
      });
    }
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
                {dayEvents.slice(0, 3).map((event, eventIndex) => {
                  return (
                    <div
                      key={eventIndex}
                      className="text-xs p-1 bg-primary/10 text-primary rounded space-y-1"
                      title={`${event.subject} ${event.categories?.length ? '- ' + event.categories.join(', ') : ''}`}
                    >
                      <div className="font-medium truncate">
                        {format(new Date(event.start.dateTime), 'HH:mm', { locale: fr })} {event.subject}
                      </div>
                      {event.categories && event.categories.length > 0 && (
                        <div className="text-xs bg-muted/50 px-2 py-1 rounded inline-flex items-center gap-1">
                          <span>📂</span>
                          <span>{event.categories.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
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
            onClick={refreshCalendar}
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {format(currentDate, 'MMMM yyyy', { locale: fr })}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <Badge variant="secondary">
                  {events.length} événement{events.length > 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {renderCalendarGrid()}
            </CardContent>
          </Card>
        </div>

        {/* Panneau latéral droit */}
        <div className="space-y-6">
          {/* Événements du jour sélectionné */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </CardTitle>
              <CardDescription>
                {getEventsForSelectedDate().length} événement{getEventsForSelectedDate().length > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getEventsForSelectedDate().length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun événement pour ce jour.</p>
              ) : (
                getEventsForSelectedDate().map((event, index) => {
                  const startTime = formatDateTime(event.start.dateTime);
                  const endTime = formatDateTime(event.end.dateTime);
                  
                  return (
                    <div key={index} className="space-y-2 p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm">{event.subject}</h4>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{startTime.time} - {endTime.time}</span>
                      </div>
                      
                      {event.location?.displayName && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{event.location.displayName}</span>
                        </div>
                      )}
                      
                      {event.categories && event.categories.length > 0 && (
                        <div className="text-xs bg-muted/50 px-2 py-1 rounded inline-flex items-center gap-1">
                          <span>📂</span>
                          <span>{event.categories.join(', ')}</span>
                        </div>
                      )}
                      
                      {event.bodyPreview && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {event.bodyPreview}
                        </p>
                      )}
                      
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Prochains événements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prochains événements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events
                .filter(event => new Date(event.start.dateTime) > new Date())
                .slice(0, 5)
                .map((event, index) => {
                  const startTime = formatDateTime(event.start.dateTime);
                  
                  return (
                    <div key={index} className="flex items-start space-x-3 text-sm">
                      <div className="flex-shrink-0 w-12 text-center">
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(event.start.dateTime), 'dd/MM', { locale: fr })}
                        </div>
                        <div className="text-xs font-medium">
                          {startTime.time}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.subject}</p>
                        {event.location?.displayName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {event.location.displayName}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              
              {events.filter(event => new Date(event.start.dateTime) > new Date()).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun événement à venir.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}