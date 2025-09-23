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
  heatmapMode?: boolean;
}

const MapComponent: React.FC<MapComponentProps> = ({ companies, heatmapMode = false }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create map
    map.current = L.map(mapRef.current).setView([46.603354, 1.888334], 6);

    // Add minimalist tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add bubbles or heatmap to map
  useEffect(() => {
    if (!map.current || !companies.length) return;

    // Clear existing layers (keep only the base tile layer)
    map.current.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Rectangle) {
        map.current?.removeLayer(layer);
      }
    });

    if (heatmapMode) {
      // Create heatmap based on company concentration
      const bounds = map.current.getBounds();
      const step = 0.1; // Grid resolution (0.1 degrees)
      
      // Create a grid and count companies in each cell
      const grid = new Map<string, number>();
      
      companies.forEach((company) => {
        if (company.latitude && company.longitude) {
          const lat = Math.floor(company.latitude / step) * step;
          const lng = Math.floor(company.longitude / step) * step;
          const key = `${lat},${lng}`;
          grid.set(key, (grid.get(key) || 0) + 1);
        }
      });

      // Find max concentration for color scaling
      const maxConcentration = Math.max(...Array.from(grid.values()), 1);

      // Add heatmap cells
      grid.forEach((count, key) => {
        const [lat, lng] = key.split(',').map(Number);
        const intensity = count / maxConcentration;
        
        // Color based on intensity (from blue to red)
        const hue = (1 - intensity) * 240; // Blue (240) to Red (0)
        const color = `hsl(${hue}, 70%, 50%)`;
        
        const cell = L.rectangle(
          [[lat, lng], [lat + step, lng + step]],
          {
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.7,
            fillOpacity: 0.5 + intensity * 0.3
          }
        );

        // Add popup with concentration info
        cell.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-sm mb-1">Zone de concentration</h3>
            <p class="text-xs"><strong>Nombre d'entreprises:</strong> ${count}</p>
            <p class="text-xs"><strong>Intensité:</strong> ${Math.round(intensity * 100)}%</p>
          </div>
        `);

        cell.addTo(map.current!);
      });
    } else {
      // Original bubble mode
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
    }

    // Fit map to show all companies
    if (companies.length > 0) {
      const validCompanies = companies.filter(c => c.latitude && c.longitude);
      if (validCompanies.length > 0) {
        const bounds = L.latLngBounds(
          validCompanies.map(c => [c.latitude, c.longitude])
        );
        map.current.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [companies, heatmapMode]);

  return (
    <div className="h-[500px] w-full rounded-lg border shadow-lg overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default MapComponent;