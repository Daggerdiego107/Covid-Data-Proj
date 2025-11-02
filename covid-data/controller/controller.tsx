import NetInfo from '@react-native-community/netinfo';
import {
  ApiService,
  StorageService,
  CountryModel,
  HistoricalDataModel,
  CountryData,
  HistoricalData,
  STORAGE_KEYS,
  CACHE_DURATION,
  isDataStale
} from '../model/model';

class StorageController {
  private storage: StorageService;

  constructor() {
    this.storage = new StorageService();
  }

  async saveCountriesData(countries: CountryData[]): Promise<boolean> {
    try {
      const success = await this.storage.setItem(STORAGE_KEYS.COUNTRIES_DATA, countries);
      if (success) {
        await this.storage.setItem(STORAGE_KEYS.LAST_UPDATE, Date.now());
      }
      return success;
    } catch (error) {
      console.error('Error saving countries data:', error);
      return false;
    }
  }

  async getCountriesData(): Promise<CountryData[] | null> {
    try {
      return await this.storage.getItem<CountryData[]>(STORAGE_KEYS.COUNTRIES_DATA);
    } catch (error) {
      console.error('Error getting countries data:', error);
      return null;
    }
  }

  async saveHistoricalData(countryName: string, data: HistoricalData): Promise<boolean> {
    try {
      const key = `${STORAGE_KEYS.HISTORICAL_PREFIX}${countryName}`;
      return await this.storage.setItem(key, data);
    } catch (error) {
      console.error('Error saving historical data:', error);
      return false;
    }
  }

  async getHistoricalData(countryName: string): Promise<HistoricalData | null> {
    try {
      const key = `${STORAGE_KEYS.HISTORICAL_PREFIX}${countryName}`;
      return await this.storage.getItem<HistoricalData>(key);
    } catch (error) {
      console.error('Error getting historical data:', error);
      return null;
    }
  }

  async getLastUpdateTime(): Promise<number | null> {
    try {
      return await this.storage.getItem<number>(STORAGE_KEYS.LAST_UPDATE);
    } catch (error) {
      console.error('Error getting last update time:', error);
      return null;
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      return await this.storage.clear();
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }
}

interface FetchResult<T> {
  success: boolean;
  data: T;
  fromCache?: boolean;
  message?: string;
  error?: string;
}

class CovidController {
  private api: ApiService;
  private storageController: StorageController;
  private isOnline: boolean;

  constructor() {
    this.api = new ApiService();
    this.storageController = new StorageController();
    this.isOnline = true;
    this.setupNetworkListener();
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
    });
  }

  async checkConnection(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    return this.isOnline;
  }

  async fetchAllCountries(forceRefresh: boolean = false): Promise<FetchResult<CountryModel[]>> {
    try {
      const isConnected = await this.checkConnection();
      const lastUpdate = await this.storageController.getLastUpdateTime();
      const dataIsStale = isDataStale(lastUpdate, CACHE_DURATION);

      if (!forceRefresh && !dataIsStale) {
        const cachedData = await this.storageController.getCountriesData();
        if (cachedData) {
          return {
            success: true,
            data: CountryModel.fromArray(cachedData),
            fromCache: true
          };
        }
      }

      if (isConnected && (forceRefresh || dataIsStale)) {
        const response = await this.api.getAllCountries();
        
        if (response.success && response.data) {
          const countries = CountryModel.fromArray(response.data);
          await this.storageController.saveCountriesData(response.data);
          
          return {
            success: true,
            data: countries,
            fromCache: false
          };
        }
      }

      const cachedData = await this.storageController.getCountriesData();
      if (cachedData) {
        return {
          success: true,
          data: CountryModel.fromArray(cachedData),
          fromCache: true,
          message: 'Using cached data (offline or API unavailable)'
        };
      }

      return {
        success: false,
        error: 'No data available',
        data: []
      };
    } catch (error: any) {
      console.error('Error in fetchAllCountries:', error);
      
      const cachedData = await this.storageController.getCountriesData();
      if (cachedData) {
        return {
          success: true,
          data: CountryModel.fromArray(cachedData),
          fromCache: true,
          message: 'Using cached data due to error'
        };
      }

      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async fetchCountryDetails(countryName: string): Promise<FetchResult<CountryModel | null>> {
    try {
      const isConnected = await this.checkConnection();

      if (isConnected) {
        const response = await this.api.getCountry(countryName);
        
        if (response.success && response.data) {
          return {
            success: true,
            data: new CountryModel(response.data)
          };
        }
      }

      const cachedCountries = await this.storageController.getCountriesData();
      if (cachedCountries) {
        const country = cachedCountries.find(c => c.country === countryName);
        if (country) {
          return {
            success: true,
            data: new CountryModel(country),
            fromCache: true
          };
        }
      }

      return {
        success: false,
        error: 'Country data not available',
        data: null
      };
    } catch (error: any) {
      console.error('Error in fetchCountryDetails:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  async fetchHistoricalData(countryName: string, days: string = 'all'): Promise<FetchResult<HistoricalDataModel | null>> {
    try {
      const isConnected = await this.checkConnection();

      const cachedData = await this.storageController.getHistoricalData(countryName);

      if (isConnected) {
        const response = await this.api.getHistoricalData(countryName, days);
        
        if (response.success && response.data) {
          const historicalData = new HistoricalDataModel(response.data);
          await this.storageController.saveHistoricalData(countryName, response.data);
          
          return {
            success: true,
            data: historicalData,
            fromCache: false
          };
        }
      }

      if (cachedData) {
        return {
          success: true,
          data: new HistoricalDataModel(cachedData),
          fromCache: true
        };
      }

      return {
        success: false,
        error: 'Historical data not available',
        data: null
      };
    } catch (error: any) {
      console.error('Error in fetchHistoricalData:', error);
      
      const cachedData = await this.storageController.getHistoricalData(countryName);
      if (cachedData) {
        return {
          success: true,
          data: new HistoricalDataModel(cachedData),
          fromCache: true
        };
      }

      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  async refreshData(): Promise<FetchResult<CountryModel[]>> {
    return await this.fetchAllCountries(true);
  }
}

export const covidController = new CovidController();
export default covidController;