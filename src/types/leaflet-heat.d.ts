
// Déclare le module 'leaflet.heat' pour satisfaire l'importation dynamique
declare module 'leaflet.heat';

// Déclarez l'existence de la méthode heatLayer sur l'objet global L
// C'est une correction plus propre que le 'L as any' dans le composant.
import * as L from 'leaflet';

declare module 'leaflet' {
    // Déclaration simplifiée de la fonction heatLayer
    export function heatLayer(latLngs: L.LatLngExpression[] | L.HeatLatLngTuple[], options?: L.HeatIconOptions): L.HeatLayer;

    // Si vous avez besoin de types précis pour l'option, vous pouvez les ajouter ici:
    interface HeatIconOptions {
         minOpacity?: number;
         maxZoom?: number;
         radius?: number;
         blur?: number;
         gradient?: { [key: number]: string };
    }

    // Déclaration simplifiée de la classe HeatLayer
    interface HeatLayer extends L.Layer {
        setLatLngs(latlngs: L.HeatLatLngTuple[]): this;
        addLatLng(latlng: L.HeatLatLngTuple): this;
    }

    // Tuple étendu pour Leaflet Heat [lat, lng, intensity]
    type HeatLatLngTuple = [number, number, number];
}