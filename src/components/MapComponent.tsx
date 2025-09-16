import React, { useMemo } from 'react';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
  orderStats?: Array<{
    year: number;
    totalOrders: number;
    totalAmount: number;
  }>;
}

interface MapComponentProps {
  companies: Company[];
}

const MapComponent: React.FC<MapComponentProps> = ({ companies }) => {
  // Version allégée : limiter l'affichage aux 100 premières entreprises pour éviter le plantage
  const limitedCompanies = useMemo(() => companies.slice(0, 100), [companies]);
  
  // Calculer le centre approximatif de la France
  const centerLat = 46.603354;
  const centerLng = 1.888334;
  
  // Générer une URL de carte statique simple (pas d'API key requise)
  const staticMapUrl = useMemo(() => {
    if (limitedCompanies.length === 0) return '';
    
    // Créer les marqueurs pour la carte statique OpenStreetMap
    const markers = limitedCompanies.slice(0, 20).map((company, index) => 
      `${company.latitude},${company.longitude}`
    ).join('|');
    
    // Utiliser OpenStreetMap avec des marqueurs simples
    return `https://www.openstreetmap.org/export/embed.html?bbox=-5.1406,41.3334,9.5596,51.0890&layer=mapnik&marker=${centerLat},${centerLng}`;
  }, [limitedCompanies]);

  return (
    <div className="space-y-4">
      {companies.length > limitedCompanies.length && (
        <div className="text-sm text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
          Affichage des {limitedCompanies.length} premières entreprises sur {companies.length} total
          <br />
          <span className="text-xs">Carte allégée pour éviter les problèmes de performance</span>
        </div>
      )}
      
      {/* Carte statique simple */}
      <div className="h-[500px] w-3/4 mx-auto rounded-lg border shadow-lg overflow-hidden">
        <iframe
          src={staticMapUrl}
          width="100%"
          height="100%"
          className="border-0"
          title="Carte des entreprises"
        />
      </div>
      
      {/* Liste simple des entreprises affichées */}
      <div className="max-h-60 overflow-y-auto bg-muted/20 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Entreprises affichées ({limitedCompanies.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {limitedCompanies.map((company) => (
            <div key={company.id} className="p-2 bg-background rounded border">
              <div className="font-medium truncate">{company.company_name}</div>
              <div className="text-muted-foreground text-xs">
                {company.city && `${company.city} • `}SIPI: {company.sipi_number}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapComponent;