import React, { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

interface BubbleData {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  department: string;
  city: string;
  sipi: string;
  totalOrders: number;
  totalAmount: number;
}

const MapComponent: React.FC<MapComponentProps> = ({ companies }) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  // Transform companies data into bubble chart data
  const bubbleData = useMemo(() => {
    const departments = [...new Set(companies.map(c => c.general_department).filter(Boolean))];
    const departmentColors = [
      'hsl(var(--primary))',
      'hsl(var(--secondary))',
      'hsl(var(--accent))',
      'hsl(var(--destructive))',
      'hsl(var(--warning))',
      'hsl(var(--success))',
    ];

    return companies.map((company, index) => {
      const totalOrders = company.orderStats?.reduce((sum, stat) => sum + stat.totalOrders, 0) || 0;
      const totalAmount = company.orderStats?.reduce((sum, stat) => sum + stat.totalAmount, 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;
      
      const departmentIndex = departments.indexOf(company.general_department || '');
      
      return {
        id: company.id,
        name: company.company_name,
        x: departmentIndex >= 0 ? departmentIndex : 0,
        y: totalOrders,
        z: Math.max(avgOrderValue / 1000, 10), // Taille de bulle basée sur valeur moyenne
        department: company.general_department || 'Non défini',
        city: company.city || 'Non définie',
        sipi: company.sipi_number,
        totalOrders,
        totalAmount,
        color: departmentColors[departmentIndex % departmentColors.length] || 'hsl(var(--muted-foreground))',
      };
    });
  }, [companies]);

  const departments = useMemo(() => {
    return [...new Set(companies.map(c => c.general_department).filter(Boolean))];
  }, [companies]);

  const filteredData = selectedDepartment 
    ? bubbleData.filter(d => d.department === selectedDepartment)
    : bubbleData;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as BubbleData;
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">SIPI: {data.sipi}</p>
          <p className="text-sm">Ville: {data.city}</p>
          <p className="text-sm">Département: {data.department}</p>
          <p className="text-sm">Commandes totales: {data.totalOrders}</p>
          <p className="text-sm">Montant total: {data.totalAmount.toLocaleString('fr-FR')} €</p>
          <p className="text-sm">Valeur moyenne: {data.totalOrders > 0 ? (data.totalAmount / data.totalOrders).toLocaleString('fr-FR') : '0'} €</p>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const radius = Math.min(Math.max(payload.z, 8), 30);
    
    return (
      <circle 
        cx={cx} 
        cy={cy} 
        r={radius} 
        fill={payload.color}
        fillOpacity={0.7}
        stroke={payload.color}
        strokeWidth={2}
        className="cursor-pointer hover:fill-opacity-90 transition-all duration-200"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
        Visualisation en bulles - {companies.length} entreprises
        <br />
        <span className="text-xs">Taille des bulles = Valeur moyenne des commandes</span>
      </div>

      {/* Filtres par département */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setSelectedDepartment(null)}
          className={`px-3 py-1 rounded-full text-xs transition-colors ${
            !selectedDepartment 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Tous ({companies.length})
        </button>
        {departments.map((dept) => {
          const count = companies.filter(c => c.general_department === dept).length;
          return (
            <button
              key={dept}
              onClick={() => setSelectedDepartment(dept)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                selectedDepartment === dept 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {dept} ({count})
            </button>
          );
        })}
      </div>
      
      <div className="h-[500px] w-full rounded-lg border shadow-lg bg-background p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            data={filteredData}
            margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number" 
              dataKey="x" 
              name="Département"
              domain={[0, Math.max(departments.length - 1, 1)]}
              ticks={departments.map((_, i) => i)}
              tickFormatter={(value) => departments[value] || ''}
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={12}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name="Nombre de commandes"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter 
              data={filteredData} 
              fill="hsl(var(--primary))"
              shape={<CustomDot />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      {/* Légende */}
      <div className="bg-muted/20 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Légende</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <strong>Axe X :</strong> Départements
          </div>
          <div>
            <strong>Axe Y :</strong> Nombre total de commandes
          </div>
          <div>
            <strong>Taille des bulles :</strong> Valeur moyenne des commandes
          </div>
        </div>
      </div>

      {/* Liste des entreprises */}
      <div className="max-h-60 overflow-y-auto bg-muted/20 rounded-lg p-4">
        <h4 className="font-semibold mb-2">
          Entreprises {selectedDepartment ? `- ${selectedDepartment}` : ''} ({filteredData.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {filteredData.map((company) => (
            <div key={company.id} className="p-2 bg-background rounded border">
              <div className="font-medium truncate">{company.name}</div>
              <div className="text-muted-foreground text-xs">
                {company.city} • SIPI: {company.sipi}
              </div>
              <div className="text-xs mt-1">
                {company.totalOrders} commandes • {company.totalAmount.toLocaleString('fr-FR')} €
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapComponent;