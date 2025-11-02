import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import covidController from '../controller/controller';
import { 
  CountryModel, 
  HistoricalDataModel,
  ChartDataPoint,
  COLORS, 
  formatNumber, 
  formatDate, 
  sortCountriesByCases 
} from '../model/model';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 32;
const CHART_HEIGHT = 200;

type RootStackParamList = {
  Home: undefined;
  CountryDetail: { country: CountryModel };
};

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
type CountryDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'CountryDetail'>;

const Stack = createNativeStackNavigator<RootStackParamList>();

interface CountryCardProps {
  country: CountryModel;
  onPress: (country: CountryModel) => void;
}

const CountryCard: React.FC<CountryCardProps> = ({ country, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => onPress(country)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Image
          source={{ uri: country.countryInfo.flag }}
          style={styles.flag}
          resizeMode="contain"
        />
        <View style={styles.countryInfo}>
          <Text style={styles.countryName}>{country.country}</Text>
          <Text style={styles.population}>
            Population: {formatNumber(country.population)}
          </Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.cases }]}>
            {formatNumber(country.cases)}
          </Text>
          <Text style={styles.statLabel}>Cases</Text>
          {country.todayCases > 0 && (
            <Text style={styles.todayValue}>
              +{formatNumber(country.todayCases)}
            </Text>
          )}
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.deaths }]}>
            {formatNumber(country.deaths)}
          </Text>
          <Text style={styles.statLabel}>Deaths</Text>
          {country.todayDeaths > 0 && (
            <Text style={styles.todayValue}>
              +{formatNumber(country.todayDeaths)}
            </Text>
          )}
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.recovered }]}>
            {formatNumber(country.recovered)}
          </Text>
          <Text style={styles.statLabel}>Recovered</Text>
        </View>
      </View>

      <View style={styles.ratesContainer}>
        <Text style={styles.rateText}>
          Death Rate: {country.getDeathRate()}%
        </Text>
        <Text style={styles.rateText}>
          Recovery Rate: {country.getRecoveryRate()}%
        </Text>
      </View>
    </TouchableOpacity>
  );
};

interface ChartViewProps {
  data: ChartDataPoint[];
}

const ChartView: React.FC<ChartViewProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.chartMainContainer}>
        <Text style={styles.noDataText}>No historical data available</Text>
      </View>
    );
  }

  const maxCases = Math.max(...data.map(d => d.cases));
  const maxDeaths = Math.max(...data.map(d => d.deaths));
  
  const step = Math.ceil(data.length / 30);
  const sampledData = data.filter((_, index) => index % step === 0);

  const renderBar = (value: number, maxValue: number, color: string, label: string, index: number) => {
    const height = (value / maxValue) * CHART_HEIGHT;
    const barWidth = (CHART_WIDTH - 40) / sampledData.length;

    return (
      <View key={`${label}-${index}`} style={[styles.barContainer, { width: barWidth }]}>
        <View style={styles.barWrapper}>
          <View
            style={[
              styles.bar,
              {
                height: Math.max(height, 2),
                backgroundColor: color,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.chartMainContainer}>
      <Text style={styles.chartTitle}>Historical Data Trend</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartContainer}>
          <View style={styles.chartSection}>
            <Text style={styles.chartLabel}>Cases</Text>
            <View style={styles.chart}>
              {sampledData.map((item, index) =>
                renderBar(item.cases, maxCases, COLORS.cases, 'cases', index)
              )}
            </View>
          </View>

          <View style={styles.chartSection}>
            <Text style={styles.chartLabel}>Deaths</Text>
            <View style={styles.chart}>
              {sampledData.map((item, index) =>
                renderBar(item.deaths, maxDeaths, COLORS.deaths, 'deaths', index)
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.cases }]} />
          <Text style={styles.legendText}>
            Total Cases: {formatNumber(data[data.length - 1]?.cases || 0)}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.deaths }]} />
          <Text style={styles.legendText}>
            Total Deaths: {formatNumber(data[data.length - 1]?.deaths || 0)}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.recovered }]} />
          <Text style={styles.legendText}>
            Recovered: {formatNumber(data[data.length - 1]?.recovered || 0)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [countries, setCountries] = useState<CountryModel[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<CountryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    filterCountries();
  }, [searchQuery, countries]);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const result = await covidController.fetchAllCountries();

      if (result.success) {
        const sortedCountries = sortCountriesByCases(result.data);
        setCountries(sortedCountries);
        setFilteredCountries(sortedCountries);
        setFromCache(result.fromCache || false);
      }
    } catch (error) {
      console.error('Error loading countries:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const result = await covidController.refreshData();
    
    if (result.success) {
      const sortedCountries = sortCountriesByCases(result.data);
      setCountries(sortedCountries);
      setFilteredCountries(sortedCountries);
      setFromCache(result.fromCache || false);
    }
    
    setRefreshing(false);
  }, []);

  const filterCountries = () => {
    if (!searchQuery.trim()) {
      setFilteredCountries(countries);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = countries.filter(country =>
      country.country.toLowerCase().includes(query)
    );
    setFilteredCountries(filtered);
  };

  const handleCountryPress = (country: CountryModel) => {
    navigation.navigate('CountryDetail', { country });
  };

  const renderHeader = () => (
    <View style={styles.homeHeader}>
      <Text style={styles.headerTitle}>COVID-19 Tracker</Text>
      <Text style={styles.headerSubtitle}>
        {fromCache ? '📱 Offline Data' : '🌐 Live Data'}
      </Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search countries..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#999"
      />
      <View style={styles.statsHeader}>
        <Text style={styles.statsText}>
          Total Countries: {filteredCountries.length}
        </Text>
        <Text style={styles.statsText}>
          Pull down to refresh
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading COVID-19 data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <FlatList
        data={filteredCountries}
        renderItem={({ item }) => (
          <CountryCard country={item} onPress={handleCountryPress} />
        )}
        keyExtractor={(item, index) => item.countryInfo._id?.toString() || item.country || index.toString()}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const CountryDetailScreen: React.FC<CountryDetailScreenProps> = ({ route }) => {
  const { country } = route.params;
  const [historicalData, setHistoricalData] = useState<HistoricalDataModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    loadHistoricalData();
  }, []);

  const loadHistoricalData = async () => {
    try {
      setLoading(true);
      const result = await covidController.fetchHistoricalData(country.country);
      
      if (result.success && result.data) {
        setHistoricalData(result.data);
        setFromCache(result.fromCache || false);
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistoricalData();
    setRefreshing(false);
  };

  interface StatCardProps {
    label: string;
    value: number;
    color: string;
    todayValue?: number;
  }

  const StatCard: React.FC<StatCardProps> = ({ label, value, color, todayValue }) => (
    <View style={styles.statCard}>
      <Text style={styles.statCardLabel}>{label}</Text>
      <Text style={[styles.statCardValue, { color }]}>{formatNumber(value)}</Text>
      {todayValue !== undefined && todayValue > 0 && (
        <Text style={styles.statCardTodayValue}>+{formatNumber(todayValue)} today</Text>
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      <View style={styles.detailHeader}>
        <Image
          source={{ uri: country.countryInfo.flag }}
          style={styles.detailFlag}
          resizeMode="contain"
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.detailCountryName}>{country.country}</Text>
          <Text style={styles.continent}>{country.continent}</Text>
          <Text style={styles.detailPopulation}>
            Population: {formatNumber(country.population)}
          </Text>
          <Text style={styles.updateInfo}>
            {fromCache ? '📱 Offline Data' : '🌐 Live Data'}
          </Text>
          <Text style={styles.updateDate}>
            Updated: {formatDate(country.updated)}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="Total Cases"
          value={country.cases}
          color={COLORS.cases}
          todayValue={country.todayCases}
        />
        <StatCard
          label="Deaths"
          value={country.deaths}
          color={COLORS.deaths}
          todayValue={country.todayDeaths}
        />
        <StatCard
          label="Recovered"
          value={country.recovered}
          color={COLORS.recovered}
          todayValue={country.todayRecovered}
        />
        <StatCard
          label="Active Cases"
          value={country.active}
          color="#2196f3"
        />
        <StatCard
          label="Critical"
          value={country.critical}
          color="#ff5722"
        />
        <StatCard
          label="Tests"
          value={country.tests}
          color="#9c27b0"
        />
      </View>

      <View style={styles.ratesSection}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Death Rate:</Text>
          <Text style={styles.rateValue}>{country.getDeathRate()}%</Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Recovery Rate:</Text>
          <Text style={styles.rateValue}>{country.getRecoveryRate()}%</Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Active Rate:</Text>
          <Text style={styles.rateValue}>{country.getActiveRate()}%</Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Cases per Million:</Text>
          <Text style={styles.rateValue}>
            {formatNumber(country.casesPerOneMillion)}
          </Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Deaths per Million:</Text>
          <Text style={styles.rateValue}>
            {formatNumber(country.deathsPerOneMillion)}
          </Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Tests per Million:</Text>
          <Text style={styles.rateValue}>
            {formatNumber(country.testsPerOneMillion)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading historical data...</Text>
        </View>
      ) : historicalData ? (
        <ChartView data={historicalData.getChartData()} />
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            Historical data not available for this country
          </Text>
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

export default function App() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CountryDetail"
        component={CountryDetailScreen}
        options={({ route }) => ({
          title: route.params.country.country,
        })}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  homeHeader: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  flag: {
    width: 60,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  population: {
    fontSize: 12,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  todayValue: {
    fontSize: 10,
    color: COLORS.error,
    marginTop: 2,
  },
  ratesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  rateText: {
    fontSize: 12,
    color: '#666',
  },
  detailHeader: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  detailFlag: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  detailCountryName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  continent: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  detailPopulation: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 4,
  },
  updateInfo: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 2,
  },
  updateDate: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    marginTop: 16,
  },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    margin: 8,
    width: '45%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statCardLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statCardTodayValue: {
    fontSize: 11,
    color: COLORS.error,
  },
  ratesSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rateLabel: {
    fontSize: 14,
    color: '#666',
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  chartMainContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  chartContainer: {
    paddingRight: 16,
  },
  chartSection: {
    marginBottom: 24,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  chart: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#ddd',
    paddingLeft: 8,
  },
  barContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  barWrapper: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
  },
  legendContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
});