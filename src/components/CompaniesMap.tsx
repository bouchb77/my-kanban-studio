import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building2 } from "lucide-react";
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix pour les icônes par défaut de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
}

const CompaniesMap = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch companies with GPS coordinates
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        console.log('Fetching companies with GPS coordinates...');
        const { data, error } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (error) {
          console.error('Error fetching companies:', error);
          setError('Erreur lors du chargement des entreprises');
          return;
        }

        console.log('Companies loaded:', data?.length || 0);
        setCompanies(data || []);
      } catch (error) {
        console.error('Error:', error);
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  if (loading) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises
          </CardTitle>
          <CardDescription>
            Localisation géographique des entreprises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center bg-muted/30 rounded-lg">
            <div className="text-muted-foreground">Chargement de la carte...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="text-destructive">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Carte des entreprises
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span>Localisation géographique des entreprises</span>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" />
            <span>{companies.length} entreprises géolocalisées</span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {companies.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center bg-muted/30 rounded-lg">
            <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
            <div className="text-muted-foreground text-center">
              <p className="font-medium">Aucune entreprise géolocalisée</p>
              <p className="text-sm mt-1">Les entreprises seront affichées ici une fois géolocalisées</p>
            </div>
          </div>
        ) : (
          <div className="h-96 rounded-lg overflow-hidden">
            <MapContainer
              center={[46.603354, 1.888334]} // Centre de la France
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {companies.map((company) => (
                <Marker
                  key={company.id}
                  position={[company.latitude, company.longitude]}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold text-sm">{company.company_name}</h3>
                      <p className="text-xs text-muted-foreground">SIPI: {company.sipi_number}</p>
                      {company.address1 && (
                        <p className="text-xs">{company.address1}</p>
                      )}
                      {company.city && (
                        <p className="text-xs">
                          {company.city}
                          {company.general_department && ` (${company.general_department})`}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompaniesMap;