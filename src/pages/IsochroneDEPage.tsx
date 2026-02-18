import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Download, Calculator, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import LeafletMapDE from '@/components/LeafletMapDE';

interface CompanyDE {
  id: string;
  company_name: string;
  address1?: string;
  address2?: string;
  city?: string;
  postal_code?: string;
  region?: string;
  sipi_number?: string;
  latitude?: number;
  longitude?: number;
}

interface IsochronePoint {
  lat: number;
  lng: number;
}

const IsochroneDEPage = () => {
  const [companies, setCompanies] = useState<CompanyDE[]>([]);
  const [loading, setLoading] = useState(true);
  const [centerLocation, setCenterLocation] = useState('');
  const [travelTime, setTravelTime] = useState(60);
  const [transportMode, setTransportMode] = useState('driving');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isochronePolygon, setIsochronePolygon] = useState<IsochronePoint[]>([]);
  const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies_de')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;
      setCompanies((data || []).map(c => ({
        id: c.id,
        company_name: c.company_name,
        address1: c.address1 ?? undefined,
        address2: c.address2 ?? undefined,
        city: c.city ?? undefined,
        postal_code: c.postal_code ?? undefined,
        region: c.region ?? undefined,
        sipi_number: c.sipi_number ?? undefined,
        latitude: (c as any).latitude ?? undefined,
        longitude: (c as any).longitude ?? undefined,
      })));
    } catch (err) {
      console.error('Erreur chargement companies DE:', err);
      toast({ title: "Erreur", description: "Impossible de charger les entreprises DE", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateIsochrone = async () => {
    if (!centerLocation.trim()) {
      toast({ title: "Erreur", description: "Veuillez saisir une adresse de départ", variant: "destructive" });
      return;
    }

    setIsCalculating(true);
    try {
      const geocodeResponse = await supabase.functions.invoke('geocode-address', {
        body: { address: centerLocation },
      });
      if (geocodeResponse.error) throw new Error('Erreur géocodage: ' + geocodeResponse.error.message);

      const { lat, lng } = geocodeResponse.data;
      setCenterCoords({ lat, lng });

      const isochroneResponse = await supabase.functions.invoke('calculate-isochrone', {
        body: {
          lat, lng,
          time: travelTime,
          profile: transportMode === 'driving' ? 'driving-car' : 'foot-walking',
        },
      });
      if (isochroneResponse.error) throw new Error('Erreur isochrone: ' + isochroneResponse.error.message);

      setIsochronePolygon(isochroneResponse.data.polygon);
    } catch (err) {
      console.error('Erreur calcul isochrone DE:', err);
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur lors du calcul", variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: IsochronePoint[]): boolean => {
    if (polygon.length < 3) return false;
    let inside = false;
    let j = polygon.length - 1;
    for (let i = 0; i < polygon.length; i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      if (((yi > point.lng) !== (yj > point.lng)) &&
        (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
      j = i;
    }
    return inside;
  };


  const handleExport = () => {
    const companiesInZone = isochronePolygon.length > 0
      ? companies.filter(c => {
          if (!c.latitude || !c.longitude) return false;
          return isPointInPolygon({ lat: c.latitude, lng: c.longitude }, isochronePolygon);
        })
      : companies;

    if (companiesInZone.length === 0) {
      toast({ title: "Info", description: "Aucune entreprise dans la zone à exporter" });
      return;
    }

    const headers = ['N° SIPI', 'Entreprise', 'Adresse', 'Adresse 2', 'Ville', 'CP', 'Région'];
    const rows = companiesInZone.map(c => [
      c.sipi_number || '', c.company_name, c.address1 || '', c.address2 || '',
      c.city || '', c.postal_code || '', c.region || '',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entreprises_de_zone_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Isochrone Allemagne (DE)</h1>
        <p className="text-muted-foreground mt-1">
          Visualisez les clients allemands par zone géographique
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Paramètres de Calcul
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="location-de">Adresse de départ</Label>
                <Input
                  id="location-de"
                  value={centerLocation}
                  onChange={(e) => setCenterLocation(e.target.value)}
                  placeholder="Musterstraße 1, Berlin"
                />
              </div>
              <div>
                <Label htmlFor="time-de">Temps de trajet (min)</Label>
                <Input
                  id="time-de"
                  type="number"
                  value={travelTime}
                  onChange={(e) => setTravelTime(Number(e.target.value))}
                  placeholder="60"
                />
              </div>
              <div>
                <Label htmlFor="transport-de">Mode de transport</Label>
                <Select value={transportMode} onValueChange={setTransportMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driving">Voiture</SelectItem>
                    <SelectItem value="walking">À pied</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCalculateIsochrone} disabled={isCalculating} className="flex items-center gap-2">
                {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                Calculer l'Isochrone
              </Button>
              <Button
                onClick={handleExport}
                disabled={companies.length === 0 || isochronePolygon.length === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exporter Clients Zone
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carte des Entreprises DE</CardTitle>
          </CardHeader>
          <CardContent>
            <LeafletMapDE
              companies={companies}
              centerLocation={centerCoords}
              isochronePolygon={isochronePolygon}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IsochroneDEPage;
