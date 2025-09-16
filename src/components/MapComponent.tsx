import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create map
    map.current = L.map(mapRef.current).setView([46.603354, 1.888334], 6);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add bubbles to map
  useEffect(() => {
    if (!map.current || !companies.length) return;

    // Clear existing layers
    map.current.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map.current?.removeLayer(layer);
      }
    });

    // Calculate bubble sizes based on average orders per year
    const averageOrdersPerYear = companies.map(company => {
      const orderStats = company.orderStats || [];
      if (orderStats.length === 0) return 0;
      
      const totalOrders = orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0);
      return totalOrders / orderStats.length; // Average per year
    });
    const maxAvgOrders = Math.max(...averageOrdersPerYear, 1);
    const minAvgOrders = Math.min(...averageOrdersPerYear.filter(avg => avg > 0), 0);

    // Add bubbles for each company
    companies.forEach((company) => {
      if (company.latitude && company.longitude) {
        const totalOrders = company.orderStats?.reduce((sum, stat) => sum + stat.totalOrders, 0) || 0;
        const totalAmount = company.orderStats?.reduce((sum, stat) => sum + stat.totalAmount, 0) || 0;
        
        // Calculate average orders per year for this company
        const orderStats = company.orderStats || [];
        const avgOrdersPerYear = orderStats.length > 0 ? totalOrders / orderStats.length : 0;
        
        // Calculate bubble size (between 5 and 50 pixels) based on average per year
        const normalizedSize = avgOrdersPerYear > 0 
          ? ((avgOrdersPerYear - minAvgOrders) / (maxAvgOrders - minAvgOrders)) * 45 + 5
          : 5;

        // Create bubble in blue
        const bubble = L.circleMarker([company.latitude, company.longitude], {
          radius: normalizedSize,
          fillColor: '#3b82f6',
          color: '#2563eb',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6
        });

        // Create popup content
        const popupContent = `
          <div class="p-2">
            <h3 class="font-semibold text-sm mb-1">${company.company_name}</h3>
            <p class="text-xs text-gray-600">SIPI: ${company.sipi_number}</p>
            ${company.city ? `<p class="text-xs">Ville: ${company.city}</p>` : ''}
            ${company.general_department ? `<p class="text-xs">Département: ${company.general_department}</p>` : ''}
            <p class="text-xs mt-1"><strong>Commandes totales:</strong> ${totalOrders}</p>
            <p class="text-xs"><strong>Montant total:</strong> ${totalAmount.toLocaleString('fr-FR')} €</p>
            ${totalOrders > 0 ? `<p class="text-xs"><strong>Valeur moyenne:</strong> ${(totalAmount / totalOrders).toLocaleString('fr-FR')} €</p>` : ''}
          </div>
        `;

        bubble.bindPopup(popupContent);
        
        // Add hover effects
        bubble.on('mouseover', function() {
          this.setStyle({
            weight: 3,
            fillOpacity: 0.8
          });
        });

        bubble.on('mouseout', function() {
          this.setStyle({
            weight: 2,
            fillOpacity: 0.6
          });
        });

        bubble.addTo(map.current!);
      }
    });

    // Fit map to show all bubbles
    if (companies.length > 0) {
      const validCompanies = companies.filter(c => c.latitude && c.longitude);
      if (validCompanies.length > 0) {
        const bounds = L.latLngBounds(
          validCompanies.map(c => [c.latitude, c.longitude])
        );
        map.current.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [companies]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
        Carte à bulles interactive - {companies.length} entreprises
        <br />
        <span className="text-xs">Taille des bulles = Moyenne de commandes par an</span>
      </div>
      
      <div className="h-[500px] w-full rounded-lg border shadow-lg overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Liste des entreprises */}
      <div className="max-h-60 overflow-y-auto bg-muted/20 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Liste des entreprises ({companies.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {companies.map((company) => {
            const totalOrders = company.orderStats?.reduce((sum, stat) => sum + stat.totalOrders, 0) || 0;
            const totalAmount = company.orderStats?.reduce((sum, stat) => sum + stat.totalAmount, 0) || 0;
            
            return (
              <div key={company.id} className="p-2 bg-background rounded border">
                <div className="font-medium truncate">{company.company_name}</div>
                <div className="text-muted-foreground text-xs">
                  {company.city && `${company.city} • `}SIPI: {company.sipi_number}
                </div>
                <div className="text-xs mt-1">
                  {totalOrders} commandes • {totalAmount.toLocaleString('fr-FR')} €
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MapComponent;