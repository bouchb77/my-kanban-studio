import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building2 } from "lucide-react";

const MapComponent = React.lazy(() => import('./MapComponent'));

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
  const [showMap, setShowMap] = useState(true);

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
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setShowMap(true)}
                className={`px-3 py-1 rounded text-sm ${showMap ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Carte
              </button>
              <button
                onClick={() => setShowMap(false)}
                className={`px-3 py-1 rounded text-sm ${!showMap ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Liste
              </button>
            </div>
            
            {showMap ? (
              <Suspense fallback={
                <div className="h-96 flex items-center justify-center bg-muted/30 rounded-lg border">
                  <div className="text-muted-foreground">Chargement de la carte...</div>
                </div>
              }>
                <MapComponent companies={companies} />
              </Suspense>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {companies.map((company) => (
                  <div key={company.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{company.company_name}</h3>
                        <p className="text-sm text-muted-foreground">SIPI: {company.sipi_number}</p>
                        {company.address1 && (
                          <p className="text-sm">{company.address1}</p>
                        )}
                        {company.city && (
                          <p className="text-sm">
                            {company.city}
                            {company.general_department && ` (${company.general_department})`}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Lat: {company.latitude.toFixed(4)}</p>
                        <p>Lng: {company.longitude.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompaniesMap;