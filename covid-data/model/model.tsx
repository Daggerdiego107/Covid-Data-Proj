import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const API_CONFIG = {
  BASE_URL: 'https://disease.sh/v3/covid-19',
  ENDPOINTS: {
    ALL_COUNTRIES: '/countries',
    COUNTRY: '/countries',
    HISTORICAL: '/historical',
    GLOBAL: '/all'
  }
};

export const STORAGE_KEYS = {
  COUNTRIES_DATA: '@covid19_countries',
  LAST_UPDATE: '@covid19_last_update',
  HISTORICAL_PREFIX: '@covid19_historical_'
};

export const CACHE_DURATION = 3600000;

export const COLORS = {
  primary: '#6200ee',
  secondary: '#03dac6',
  error: '#b00020',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#000000',
  cases: '#ff9800',
  deaths: '#f44336',
  recovered: '#4caf50'
};

export interface CountryInfo {
  _id: number;
  iso2: string;
  iso3: string;
  lat: number;
  long: number;
  flag: string;
}

export interface CountryData {
  country: string;
  countryInfo: CountryInfo;
  updated: number;
  cases: number;
  todayCases: number;
  deaths: number;
  todayDeaths: number;
  recovered: number;
  todayRecovered: number;
  active: number;
  critical: number;
  casesPerOneMillion: number;
  deathsPerOneMillion: number;
  tests: number;
  testsPerOneMillion: number;
  population: number;
  continent: string;
  oneCasePerPeople: number;
  oneDeathPerPeople: number;
  oneTestPerPeople: number;
  activePerOneMillion: number;
  recoveredPerOneMillion: number;
  criticalPerOneMillion: number;
}

export interface HistoricalTimeline {
  cases: { [date: string]: number };
  deaths: { [date: string]: number };
  recovered: { [date: string]: number };
}

export interface HistoricalData {
  country: string;
  province: string[];
  timeline: HistoricalTimeline;
}

export interface ChartDataPoint {
  date: string;
  cases: number;
  deaths: number;
  recovered: number;
}

export class CountryModel {
  country: string;
  countryInfo: CountryInfo;
  updated: number;
  cases: number;
  todayCases: number;
  deaths: number;
  todayDeaths: number;
  recovered: number;
  todayRecovered: number;
  active: number;
  critical: number;
  casesPerOneMillion: number;
  deathsPerOneMillion: number;
  tests: number;
  testsPerOneMillion: number;
  population: number;
  continent: string;
  oneCasePerPeople: number;
  oneDeathPerPeople: number;
  oneTestPerPeople: number;
  activePerOneMillion: number;
  recoveredPerOneMillion: number;
  criticalPerOneMillion: number;

  constructor(data: CountryData) {
    this.country = data.country || '';
    this.countryInfo = data.countryInfo || {
      _id: 0,
      iso2: '',
      iso3: '',
      lat: 0,
      long: 0,
      flag: ''
    };
    this.updated = data.updated || Date.now();
    this.cases = data.cases || 0;
    this.todayCases = data.todayCases || 0;
    this.deaths = data.deaths || 0;
    this.todayDeaths = data.todayDeaths || 0;
    this.recovered = data.recovered || 0;
    this.todayRecovered = data.todayRecovered || 0;
    this.active = data.active || 0;
    this.critical = data.critical || 0;
    this.casesPerOneMillion = data.casesPerOneMillion || 0;
    this.deathsPerOneMillion = data.deathsPerOneMillion || 0;
    this.tests = data.tests || 0;
    this.testsPerOneMillion = data.testsPerOneMillion || 0;
    this.population = data.population || 0;
    this.continent = data.continent || '';
    this.oneCasePerPeople = data.oneCasePerPeople || 0;
    this.oneDeathPerPeople = data.oneDeathPerPeople || 0;
    this.oneTestPerPeople = data.oneTestPerPeople || 0;
    this.activePerOneMillion = data.activePerOneMillion || 0;
    this.recoveredPerOneMillion = data.recoveredPerOneMillion || 0;
    this.criticalPerOneMillion = data.criticalPerOneMillion || 0;
  }

  getDeathRate(): string {
    if (this.cases === 0) return '0.00';
    return ((this.deaths / this.cases) * 100).toFixed(2);
  }

  getRecoveryRate(): string {
    if (this.cases === 0) return '0.00';
    return ((this.recovered / this.cases) * 100).toFixed(2);
  }

  getActiveRate(): string {
    if (this.cases === 0) return '0.00';
    return ((this.active / this.cases) * 100).toFixed(2);
  }

  static fromArray(dataArray: CountryData[]): CountryModel[] {
    return dataArray.map(item => new CountryModel(item));
  }
}

export class HistoricalDataModel {
  country: string;
  province: string[];
  timeline: HistoricalTimeline;

  constructor(data: HistoricalData) {
    this.country = data.country || '';
    this.province = data.province || [];
    this.timeline = {
      cases: data.timeline?.cases || {},
      deaths: data.timeline?.deaths || {},
      recovered: data.timeline?.recovered || {}
    };
  }

  getChartData(): ChartDataPoint[] {
    const dates = Object.keys(this.timeline.cases);
    
    return dates.map(date => ({
      date: this.formatDate(date),
      cases: this.timeline.cases[date] || 0,
      deaths: this.timeline.deaths[date] || 0,
      recovered: this.timeline.recovered[date] || 0
    }));
  }

  formatDate(dateString: string): string {
    const [month, day, year] = dateString.split('/');
    return `${month}/${day}`;
  }

  getLatestData() {
    const dates = Object.keys(this.timeline.cases);
    const latestDate = dates[dates.length - 1];
    
    return {
      date: latestDate,
      cases: this.timeline.cases[latestDate] || 0,
      deaths: this.timeline.deaths[latestDate] || 0,
      recovered: this.timeline.recovered[latestDate] || 0
    };
  }

  getTotalCases(): number {
    const dates = Object.keys(this.timeline.cases);
    return this.timeline.cases[dates[dates.length - 1]] || 0;
  }
}

export class StorageService {
  async setItem<T>(key: string, value: T): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
      return true;
    } catch (error) {
      console.error('Error storing data:', error);
      return false;
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error retrieving data:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing data:', error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }
}

export class ApiService {
  private api;

  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getAllCountries(): Promise<{ success: boolean; data?: CountryData[]; error?: string }> {
    try {
      const response = await this.api.get<CountryData[]>(API_CONFIG.ENDPOINTS.ALL_COUNTRIES);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Error fetching all countries:', error);
      return { success: false, error: error.message };
    }
  }

  async getCountry(countryName: string): Promise<{ success: boolean; data?: CountryData; error?: string }> {
    try {
      const response = await this.api.get<CountryData>(`${API_CONFIG.ENDPOINTS.COUNTRY}/${countryName}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`Error fetching country ${countryName}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getHistoricalData(countryName: string, days: string = 'all'): Promise<{ success: boolean; data?: HistoricalData; error?: string }> {
    try {
      const response = await this.api.get<HistoricalData>(
        `${API_CONFIG.ENDPOINTS.HISTORICAL}/${countryName}?lastdays=${days}`
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`Error fetching historical data for ${countryName}:`, error);
      return { success: false, error: error.message };
    }
  }
}

export const formatNumber = (num: number): string => {
  if (!num) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const sortCountriesByCases = (countries: CountryModel[]): CountryModel[] => {
  return countries.sort((a, b) => b.cases - a.cases);
};

export const isDataStale = (lastUpdate: number | null, cacheDuration: number): boolean => {
  if (!lastUpdate) return true;
  const now = Date.now();
  return (now - lastUpdate) > cacheDuration;
};