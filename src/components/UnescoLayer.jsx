import { useMemo, useCallback, useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import unescoData from '../data/unesco-sites.json';
import useUnescoVisited from '../hooks/useUnescoVisited';
import { useTheme } from '../context/ThemeContext';

// Type colors
const TYPE_COLORS = {
  cultural: { border: '#8B4513', fill: '#DEB887' },
  natural: { border: '#228B22', fill: '#90EE90' },
  mixed: { border: '#4169E1', fill: '#87CEEB' },
};

export default function UnescoLayer() {
  const map = useMap();
  const { visitedSites, toggleSite, isVisited } = useUnescoVisited();
  const { dark } = useTheme();
  const [clusterGroup, setClusterGroup] = useState(null);

  // Create marker cluster group on mount
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
      animate: true,
      animateAddingMarkers: false,
      maxClusterRadius: 60,
      iconCreateFunction: (cluster) => {
        const childCount = cluster.getChildCount();
        let size = 'small';
        if (childCount > 50) size = 'large';
        else if (childCount > 20) size = 'medium';
        
        return L.divIcon({
          html: `<div><span>${childCount}</span></div>`,
          className: `marker-cluster marker-cluster-${size} unesco-cluster`,
          iconSize: L.point(40, 40),
        });
      },
    });

    map.addLayer(cluster);
    setClusterGroup(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [map]);

  // Create markers when data or visited state changes
  useEffect(() => {
    if (!clusterGroup) return;

    clusterGroup.clearLayers();

    unescoData.forEach((site) => {
      const visited = isVisited(site.id);
      const typeColor = TYPE_COLORS[site.type] || TYPE_COLORS.cultural;

      const marker = L.circleMarker([site.lat, site.lng], {
        radius: 6,
        fillColor: visited ? typeColor.fill : 'transparent',
        color: typeColor.border,
        weight: 2,
        opacity: dark ? 0.8 : 1,
        fillOpacity: visited ? 0.7 : 0.3,
        className: `unesco-marker unesco-${site.type} ${visited ? 'visited' : 'unvisited'}`,
      });

      const popupContent = `
        <div class="unesco-popup" style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${site.name}</h3>
          <div style="font-size: 12px; color: ${dark ? '#999' : '#666'}; margin-bottom: 8px;">
            <div>📍 ${site.country}</div>
            <div>🏛️ ${site.type.charAt(0).toUpperCase() + site.type.slice(1)}</div>
            <div>📅 ${site.year}</div>
          </div>
          <button 
            onclick="window.unescoToggleSite(${site.id})"
            style="
              width: 100%;
              padding: 6px 12px;
              background: ${visited ? '#dc3545' : '#c9a84c'};
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
            "
          >
            ${visited ? '✓ Visited' : 'Mark as Visited'}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'unesco-site-popup',
        maxWidth: 250,
      });

      clusterGroup.addLayer(marker);
    });
  }, [clusterGroup, visitedSites, isVisited, dark]);

  // Register global toggle function for popup buttons
  useEffect(() => {
    window.unescoToggleSite = (siteId) => {
      toggleSite(siteId);
    };
    return () => {
      delete window.unescoToggleSite;
    };
  }, [toggleSite]);

  return null;
}
