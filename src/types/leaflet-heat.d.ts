
// src/types/leaflet-heat.d.ts

// 1. Déclare le module pour satisfaire l'importation dynamique dans le composant
declare module 'leaflet.heat';

// 2. ÉTEND l'espace de noms Leaflet pour inclure les types du plugin
import * as L from 'leaflet';

declare module 'leaflet' {
    // Type étendu pour Heatmap: [latitude, longitude, intensité/poids]
    type HeatLatLngTuple = [number, number, number];

    // Déclaration des options passées à L.heatLayer
    interface HeatIconOptions {
         minOpacity?: number;
         maxZoom?: number;
         radius?: number;
         blur?: number;
         gradient?: { [key: number]: string };
    }
    
    // Déclaration simplifiée de l'interface HeatLayer
    interface HeatLayer extends L.Layer {
        setLatLngs(latlngs: L.HeatLatLngTuple[]): this;
        addLatLng(latlng: L.HeatLatLngTuple): this;
    }

    // Déclaration de la fonction heatLayer ajoutée à l'objet L
    function heatLayer(latLngs: L.LatLngExpression[] | HeatLatLngTuple[], options?: HeatIconOptions): HeatLayer;
}
