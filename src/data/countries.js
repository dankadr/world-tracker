import countriesConfig from '../config/countries.json';

// Static GeoJSON imports (Vite requires static import paths for bundling)
import cantonsData from './cantons.json';
import usaData from './usa.json';
import usParksData from './us-parks.json';
import nycData from './nyc.json';
import norwayData from './norway.json';
import canadaData from './canada.json';
import capitalsData from './capitals.json';
import japanData from './japan.json';
import australiaData from './australia.json';
import philippinesData from './philippines.json';
import brazilData from './brazil.json';
import franceData from './france.json';
import germanyData from './germany.json';
import italyData from './italy.json';
import spainData from './spain.json';
import mexicoData from './mexico.json';
import ukData from './uk.json';
import indiaData from './india.json';
import newZealandData from './new-zealand.json';

// Map geoFile names to imported data
const geoMap = {
  'cantons.json': cantonsData,
  'usa.json': usaData,
  'us-parks.json': usParksData,
  'nyc.json': nycData,
  'norway.json': norwayData,
  'canada.json': canadaData,
  'capitals.json': capitalsData,
  'japan.json': japanData,
  'australia.json': australiaData,
  'philippines.json': philippinesData,
  'brazil.json': brazilData,
  'france.json': franceData,
  'germany.json': germanyData,
  'italy.json': italyData,
  'spain.json': spainData,
  'mexico.json': mexicoData,
  'uk.json': ukData,
  'india.json': indiaData,
  'new-zealand.json': newZealandData,
};

// Build countries object from config
const countries = {};
for (const entry of countriesConfig) {
  countries[entry.id] = {
    ...entry,
    data: geoMap[entry.geoFile],
  };
}

export const countryList = Object.values(countries);
export default countries;
