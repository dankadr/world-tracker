import cantonsData from './cantons.json';
import usaData from './usa.json';
import norwayData from './norway.json';
import canadaData from './canada.json';

const countries = {
  ch: {
    id: 'ch',
    name: 'Switzerland',
    flag: '🇨🇭',
    regionLabel: 'Cantons',
    regionLabelSingular: 'canton',
    center: [46.8, 8.22],
    zoom: 8,
    minZoom: 2,
    maxZoom: 12,
    data: cantonsData,
    visitedColor: '#2ecc71',
    visitedHover: '#27ae60',
  },
  us: {
    id: 'us',
    name: 'United States',
    flag: '🇺🇸',
    regionLabel: 'States',
    regionLabelSingular: 'state',
    center: [39.5, -98.35],
    zoom: 4,
    minZoom: 2,
    maxZoom: 10,
    data: usaData,
    visitedColor: '#3498db',
    visitedHover: '#2980b9',
  },
  no: {
    id: 'no',
    name: 'Norway',
    flag: '🇳🇴',
    regionLabel: 'Counties & Territories',
    regionLabelSingular: 'county/territory',
    center: [68.0, 16.0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 10,
    data: norwayData,
    visitedColor: '#e74c3c',
    visitedHover: '#c0392b',
  },
  ca: {
    id: 'ca',
    name: 'Canada',
    flag: '🇨🇦',
    regionLabel: 'Provinces & Territories',
    regionLabelSingular: 'province/territory',
    center: [60.0, -96.0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 10,
    data: canadaData,
    visitedColor: '#e67e22',
    visitedHover: '#d35400',
  },
};

export const countryList = Object.values(countries);
export default countries;
