// ============================================
// AFRICAN YOUTH OBSERVATORY - DATA CONSTANTS
// All 54 African Countries & Metadata
// ============================================

import type { Country, RegionType, Theme, ThemeSlug, Indicator, YouthIndexDimension } from './database.types';

// ============================================
// COUNTRIES DATA - All 54 African Countries
// ============================================

export const AFRICAN_COUNTRIES: Country[] = [
  // NORTH AFRICA
  { id: 'dz', name: 'Algeria', isoCode: 'DZA', iso2Code: 'DZ', region: 'North Africa', capital: 'Algiers', population: 45606480, youthPopulation: 13681944, youthPercentage: 30.0, area: 2381741, currency: 'DZD', languages: ['Arabic', 'Berber', 'French'], economicBlocks: ['AMU'], flagEmoji: '🇩🇿', coordinates: { lat: 28.0339, lng: 1.6596 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'eg', name: 'Egypt', isoCode: 'EGY', iso2Code: 'EG', region: 'North Africa', capital: 'Cairo', population: 104124440, youthPopulation: 31237332, youthPercentage: 30.0, area: 1002450, currency: 'EGP', languages: ['Arabic'], economicBlocks: ['AMU', 'COMESA'], flagEmoji: '🇪🇬', coordinates: { lat: 26.8206, lng: 30.8025 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ly', name: 'Libya', isoCode: 'LBY', iso2Code: 'LY', region: 'North Africa', capital: 'Tripoli', population: 6871292, youthPopulation: 2061388, youthPercentage: 30.0, area: 1759540, currency: 'LYD', languages: ['Arabic'], economicBlocks: ['AMU'], flagEmoji: '🇱🇾', coordinates: { lat: 26.3351, lng: 17.2283 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ma', name: 'Morocco', isoCode: 'MAR', iso2Code: 'MA', region: 'North Africa', capital: 'Rabat', population: 37076584, youthPopulation: 11122975, youthPercentage: 30.0, area: 446550, currency: 'MAD', languages: ['Arabic', 'Berber', 'French'], economicBlocks: ['AMU'], flagEmoji: '🇲🇦', coordinates: { lat: 31.7917, lng: -7.0926 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'tn', name: 'Tunisia', isoCode: 'TUN', iso2Code: 'TN', region: 'North Africa', capital: 'Tunis', population: 11935766, youthPopulation: 3580730, youthPercentage: 30.0, area: 163610, currency: 'TND', languages: ['Arabic', 'French'], economicBlocks: ['AMU'], flagEmoji: '🇹🇳', coordinates: { lat: 33.8869, lng: 9.5375 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sd', name: 'Sudan', isoCode: 'SDN', iso2Code: 'SD', region: 'North Africa', capital: 'Khartoum', population: 45657202, youthPopulation: 15923611, youthPercentage: 34.9, area: 1861484, currency: 'SDG', languages: ['Arabic', 'English'], economicBlocks: ['COMESA', 'IGAD'], flagEmoji: '🇸🇩', coordinates: { lat: 12.8628, lng: 30.2176 }, createdAt: new Date(), updatedAt: new Date() },
  
  // WEST AFRICA
  { id: 'bj', name: 'Benin', isoCode: 'BEN', iso2Code: 'BJ', region: 'West Africa', capital: 'Porto-Novo', population: 13352864, youthPopulation: 4672502, youthPercentage: 35.0, area: 112622, currency: 'XOF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇧🇯', coordinates: { lat: 9.3077, lng: 2.3158 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'bf', name: 'Burkina Faso', isoCode: 'BFA', iso2Code: 'BF', region: 'West Africa', capital: 'Ouagadougou', population: 22489126, youthPopulation: 7871194, youthPercentage: 35.0, area: 274200, currency: 'XOF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇧🇫', coordinates: { lat: 12.2383, lng: -1.5616 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cv', name: 'Cabo Verde', isoCode: 'CPV', iso2Code: 'CV', region: 'West Africa', capital: 'Praia', population: 593149, youthPopulation: 177945, youthPercentage: 30.0, area: 4033, currency: 'CVE', languages: ['Portuguese'], economicBlocks: ['ECOWAS'], flagEmoji: '🇨🇻', coordinates: { lat: 16.5388, lng: -23.0418 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ci', name: "Côte d'Ivoire", isoCode: 'CIV', iso2Code: 'CI', region: 'West Africa', capital: 'Yamoussoukro', population: 28713423, youthPopulation: 10049698, youthPercentage: 35.0, area: 322463, currency: 'XOF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇨🇮', coordinates: { lat: 7.5400, lng: -5.5471 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'gm', name: 'Gambia', isoCode: 'GMB', iso2Code: 'GM', region: 'West Africa', capital: 'Banjul', population: 2486945, youthPopulation: 870431, youthPercentage: 35.0, area: 11295, currency: 'GMD', languages: ['English'], economicBlocks: ['ECOWAS'], flagEmoji: '🇬🇲', coordinates: { lat: 13.4432, lng: -15.3101 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'gh', name: 'Ghana', isoCode: 'GHA', iso2Code: 'GH', region: 'West Africa', capital: 'Accra', population: 33475870, youthPopulation: 11716555, youthPercentage: 35.0, area: 238533, currency: 'GHS', languages: ['English'], economicBlocks: ['ECOWAS'], flagEmoji: '🇬🇭', coordinates: { lat: 7.9465, lng: -1.0232 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'gn', name: 'Guinea', isoCode: 'GIN', iso2Code: 'GN', region: 'West Africa', capital: 'Conakry', population: 13865691, youthPopulation: 4852992, youthPercentage: 35.0, area: 245857, currency: 'GNF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇬🇳', coordinates: { lat: 9.9456, lng: -9.6966 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'gw', name: 'Guinea-Bissau', isoCode: 'GNB', iso2Code: 'GW', region: 'West Africa', capital: 'Bissau', population: 2060721, youthPopulation: 721252, youthPercentage: 35.0, area: 36125, currency: 'XOF', languages: ['Portuguese'], economicBlocks: ['ECOWAS'], flagEmoji: '🇬🇼', coordinates: { lat: 11.8037, lng: -15.1804 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'lr', name: 'Liberia', isoCode: 'LBR', iso2Code: 'LR', region: 'West Africa', capital: 'Monrovia', population: 5302681, youthPopulation: 1855938, youthPercentage: 35.0, area: 111369, currency: 'LRD', languages: ['English'], economicBlocks: ['ECOWAS'], flagEmoji: '🇱🇷', coordinates: { lat: 6.4281, lng: -9.4295 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ml', name: 'Mali', isoCode: 'MLI', iso2Code: 'ML', region: 'West Africa', capital: 'Bamako', population: 22395489, youthPopulation: 7838421, youthPercentage: 35.0, area: 1240192, currency: 'XOF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇲🇱', coordinates: { lat: 17.5707, lng: -3.9962 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mr', name: 'Mauritania', isoCode: 'MRT', iso2Code: 'MR', region: 'West Africa', capital: 'Nouakchott', population: 4775110, youthPopulation: 1671289, youthPercentage: 35.0, area: 1030700, currency: 'MRU', languages: ['Arabic', 'French'], economicBlocks: ['AMU'], flagEmoji: '🇲🇷', coordinates: { lat: 21.0079, lng: -10.9408 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ne', name: 'Niger', isoCode: 'NER', iso2Code: 'NE', region: 'West Africa', capital: 'Niamey', population: 26083660, youthPopulation: 9129281, youthPercentage: 35.0, area: 1267000, currency: 'XOF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇳🇪', coordinates: { lat: 17.6078, lng: 8.0817 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ng', name: 'Nigeria', isoCode: 'NGA', iso2Code: 'NG', region: 'West Africa', capital: 'Abuja', population: 223804632, youthPopulation: 78331621, youthPercentage: 35.0, area: 923768, currency: 'NGN', languages: ['English'], economicBlocks: ['ECOWAS'], flagEmoji: '🇳🇬', coordinates: { lat: 9.0820, lng: 8.6753 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sn', name: 'Senegal', isoCode: 'SEN', iso2Code: 'SN', region: 'West Africa', capital: 'Dakar', population: 17653671, youthPopulation: 6178785, youthPercentage: 35.0, area: 196722, currency: 'XOF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇸🇳', coordinates: { lat: 14.4974, lng: -14.4524 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sl', name: 'Sierra Leone', isoCode: 'SLE', iso2Code: 'SL', region: 'West Africa', capital: 'Freetown', population: 8605718, youthPopulation: 3012001, youthPercentage: 35.0, area: 71740, currency: 'SLL', languages: ['English'], economicBlocks: ['ECOWAS'], flagEmoji: '🇸🇱', coordinates: { lat: 8.4606, lng: -11.7799 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'tg', name: 'Togo', isoCode: 'TGO', iso2Code: 'TG', region: 'West Africa', capital: 'Lomé', population: 8680837, youthPopulation: 3038293, youthPercentage: 35.0, area: 56785, currency: 'XOF', languages: ['French'], economicBlocks: ['ECOWAS'], flagEmoji: '🇹🇬', coordinates: { lat: 8.6195, lng: 0.8248 }, createdAt: new Date(), updatedAt: new Date() },

  // CENTRAL AFRICA
  { id: 'cm', name: 'Cameroon', isoCode: 'CMR', iso2Code: 'CM', region: 'Central Africa', capital: 'Yaoundé', population: 27914536, youthPopulation: 9770088, youthPercentage: 35.0, area: 475442, currency: 'XAF', languages: ['French', 'English'], economicBlocks: ['CEMAC'], flagEmoji: '🇨🇲', coordinates: { lat: 7.3697, lng: 12.3547 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cf', name: 'Central African Republic', isoCode: 'CAF', iso2Code: 'CF', region: 'Central Africa', capital: 'Bangui', population: 5579144, youthPopulation: 1952701, youthPercentage: 35.0, area: 622984, currency: 'XAF', languages: ['French', 'Sango'], economicBlocks: ['CEMAC'], flagEmoji: '🇨🇫', coordinates: { lat: 6.6111, lng: 20.9394 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'td', name: 'Chad', isoCode: 'TCD', iso2Code: 'TD', region: 'Central Africa', capital: "N'Djamena", population: 17723315, youthPopulation: 6203160, youthPercentage: 35.0, area: 1284000, currency: 'XAF', languages: ['French', 'Arabic'], economicBlocks: ['CEMAC'], flagEmoji: '🇹🇩', coordinates: { lat: 15.4542, lng: 18.7322 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cg', name: 'Congo', isoCode: 'COG', iso2Code: 'CG', region: 'Central Africa', capital: 'Brazzaville', population: 5970424, youthPopulation: 2089648, youthPercentage: 35.0, area: 342000, currency: 'XAF', languages: ['French'], economicBlocks: ['CEMAC'], flagEmoji: '🇨🇬', coordinates: { lat: -0.2280, lng: 15.8277 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cd', name: 'Democratic Republic of the Congo', isoCode: 'COD', iso2Code: 'CD', region: 'Central Africa', capital: 'Kinshasa', population: 99010212, youthPopulation: 34653574, youthPercentage: 35.0, area: 2344858, currency: 'CDF', languages: ['French'], economicBlocks: ['COMESA'], flagEmoji: '🇨🇩', coordinates: { lat: -4.0383, lng: 21.7587 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'gq', name: 'Equatorial Guinea', isoCode: 'GNQ', iso2Code: 'GQ', region: 'Central Africa', capital: 'Malabo', population: 1714671, youthPopulation: 600135, youthPercentage: 35.0, area: 28051, currency: 'XAF', languages: ['Spanish', 'French', 'Portuguese'], economicBlocks: ['CEMAC'], flagEmoji: '🇬🇶', coordinates: { lat: 1.6508, lng: 10.2679 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ga', name: 'Gabon', isoCode: 'GAB', iso2Code: 'GA', region: 'Central Africa', capital: 'Libreville', population: 2388992, youthPopulation: 836147, youthPercentage: 35.0, area: 267668, currency: 'XAF', languages: ['French'], economicBlocks: ['CEMAC'], flagEmoji: '🇬🇦', coordinates: { lat: -0.8037, lng: 11.6094 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'st', name: 'São Tomé and Príncipe', isoCode: 'STP', iso2Code: 'ST', region: 'Central Africa', capital: 'São Tomé', population: 227380, youthPopulation: 79583, youthPercentage: 35.0, area: 964, currency: 'STN', languages: ['Portuguese'], economicBlocks: [], flagEmoji: '🇸🇹', coordinates: { lat: 0.1864, lng: 6.6131 }, createdAt: new Date(), updatedAt: new Date() },

  // EAST AFRICA
  { id: 'bi', name: 'Burundi', isoCode: 'BDI', iso2Code: 'BI', region: 'East Africa', capital: 'Gitega', population: 12889576, youthPopulation: 4511351, youthPercentage: 35.0, area: 27834, currency: 'BIF', languages: ['Kirundi', 'French', 'English'], economicBlocks: ['EAC', 'COMESA'], flagEmoji: '🇧🇮', coordinates: { lat: -3.3731, lng: 29.9189 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'km', name: 'Comoros', isoCode: 'COM', iso2Code: 'KM', region: 'East Africa', capital: 'Moroni', population: 836774, youthPopulation: 292871, youthPercentage: 35.0, area: 2235, currency: 'KMF', languages: ['Arabic', 'French', 'Comorian'], economicBlocks: ['COMESA'], flagEmoji: '🇰🇲', coordinates: { lat: -11.6455, lng: 43.3333 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'dj', name: 'Djibouti', isoCode: 'DJI', iso2Code: 'DJ', region: 'East Africa', capital: 'Djibouti', population: 1120849, youthPopulation: 392297, youthPercentage: 35.0, area: 23200, currency: 'DJF', languages: ['Arabic', 'French'], economicBlocks: ['IGAD', 'COMESA'], flagEmoji: '🇩🇯', coordinates: { lat: 11.8251, lng: 42.5903 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'er', name: 'Eritrea', isoCode: 'ERI', iso2Code: 'ER', region: 'East Africa', capital: 'Asmara', population: 3684032, youthPopulation: 1289411, youthPercentage: 35.0, area: 117600, currency: 'ERN', languages: ['Tigrinya', 'Arabic', 'English'], economicBlocks: ['IGAD'], flagEmoji: '🇪🇷', coordinates: { lat: 15.1794, lng: 39.7823 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'et', name: 'Ethiopia', isoCode: 'ETH', iso2Code: 'ET', region: 'East Africa', capital: 'Addis Ababa', population: 126527060, youthPopulation: 44284471, youthPercentage: 35.0, area: 1104300, currency: 'ETB', languages: ['Amharic'], economicBlocks: ['IGAD', 'COMESA'], flagEmoji: '🇪🇹', coordinates: { lat: 9.1450, lng: 40.4897 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ke', name: 'Kenya', isoCode: 'KEN', iso2Code: 'KE', region: 'East Africa', capital: 'Nairobi', population: 54027487, youthPopulation: 18909621, youthPercentage: 35.0, area: 580367, currency: 'KES', languages: ['English', 'Swahili'], economicBlocks: ['EAC', 'COMESA', 'IGAD'], flagEmoji: '🇰🇪', coordinates: { lat: -0.0236, lng: 37.9062 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mg', name: 'Madagascar', isoCode: 'MDG', iso2Code: 'MG', region: 'East Africa', capital: 'Antananarivo', population: 29611714, youthPopulation: 10364100, youthPercentage: 35.0, area: 587041, currency: 'MGA', languages: ['Malagasy', 'French'], economicBlocks: ['COMESA'], flagEmoji: '🇲🇬', coordinates: { lat: -18.7669, lng: 46.8691 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mu', name: 'Mauritius', isoCode: 'MUS', iso2Code: 'MU', region: 'East Africa', capital: 'Port Louis', population: 1266060, youthPopulation: 316515, youthPercentage: 25.0, area: 2040, currency: 'MUR', languages: ['English', 'French', 'Creole'], economicBlocks: ['COMESA', 'SADC'], flagEmoji: '🇲🇺', coordinates: { lat: -20.3484, lng: 57.5522 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'rw', name: 'Rwanda', isoCode: 'RWA', iso2Code: 'RW', region: 'East Africa', capital: 'Kigali', population: 13776698, youthPopulation: 4821844, youthPercentage: 35.0, area: 26338, currency: 'RWF', languages: ['Kinyarwanda', 'French', 'English'], economicBlocks: ['EAC', 'COMESA'], flagEmoji: '🇷🇼', coordinates: { lat: -1.9403, lng: 29.8739 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sc', name: 'Seychelles', isoCode: 'SYC', iso2Code: 'SC', region: 'East Africa', capital: 'Victoria', population: 107660, youthPopulation: 26915, youthPercentage: 25.0, area: 459, currency: 'SCR', languages: ['Seychellois Creole', 'English', 'French'], economicBlocks: ['COMESA', 'SADC'], flagEmoji: '🇸🇨', coordinates: { lat: -4.6796, lng: 55.4920 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'so', name: 'Somalia', isoCode: 'SOM', iso2Code: 'SO', region: 'East Africa', capital: 'Mogadishu', population: 18143378, youthPopulation: 6350182, youthPercentage: 35.0, area: 637657, currency: 'SOS', languages: ['Somali', 'Arabic'], economicBlocks: ['IGAD'], flagEmoji: '🇸🇴', coordinates: { lat: 5.1521, lng: 46.1996 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ss', name: 'South Sudan', isoCode: 'SSD', iso2Code: 'SS', region: 'East Africa', capital: 'Juba', population: 11381378, youthPopulation: 3983482, youthPercentage: 35.0, area: 619745, currency: 'SSP', languages: ['English'], economicBlocks: ['IGAD'], flagEmoji: '🇸🇸', coordinates: { lat: 6.8770, lng: 31.3070 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'tz', name: 'Tanzania', isoCode: 'TZA', iso2Code: 'TZ', region: 'East Africa', capital: 'Dodoma', population: 65497748, youthPopulation: 22924212, youthPercentage: 35.0, area: 947303, currency: 'TZS', languages: ['Swahili', 'English'], economicBlocks: ['EAC', 'SADC'], flagEmoji: '🇹🇿', coordinates: { lat: -6.3690, lng: 34.8888 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ug', name: 'Uganda', isoCode: 'UGA', iso2Code: 'UG', region: 'East Africa', capital: 'Kampala', population: 48582334, youthPopulation: 17003817, youthPercentage: 35.0, area: 241550, currency: 'UGX', languages: ['English', 'Swahili'], economicBlocks: ['EAC', 'COMESA', 'IGAD'], flagEmoji: '🇺🇬', coordinates: { lat: 1.3733, lng: 32.2903 }, createdAt: new Date(), updatedAt: new Date() },

  // SOUTHERN AFRICA
  { id: 'ao', name: 'Angola', isoCode: 'AGO', iso2Code: 'AO', region: 'Southern Africa', capital: 'Luanda', population: 35588987, youthPopulation: 12456145, youthPercentage: 35.0, area: 1246700, currency: 'AOA', languages: ['Portuguese'], economicBlocks: ['SADC'], flagEmoji: '🇦🇴', coordinates: { lat: -11.2027, lng: 17.8739 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'bw', name: 'Botswana', isoCode: 'BWA', iso2Code: 'BW', region: 'Southern Africa', capital: 'Gaborone', population: 2675352, youthPopulation: 802606, youthPercentage: 30.0, area: 581730, currency: 'BWP', languages: ['English', 'Setswana'], economicBlocks: ['SADC'], flagEmoji: '🇧🇼', coordinates: { lat: -22.3285, lng: 24.6849 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sz', name: 'Eswatini', isoCode: 'SWZ', iso2Code: 'SZ', region: 'Southern Africa', capital: 'Mbabane', population: 1210822, youthPopulation: 423788, youthPercentage: 35.0, area: 17364, currency: 'SZL', languages: ['English', 'Swazi'], economicBlocks: ['SADC', 'COMESA'], flagEmoji: '🇸🇿', coordinates: { lat: -26.5225, lng: 31.4659 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ls', name: 'Lesotho', isoCode: 'LSO', iso2Code: 'LS', region: 'Southern Africa', capital: 'Maseru', population: 2330318, youthPopulation: 815611, youthPercentage: 35.0, area: 30355, currency: 'LSL', languages: ['Sesotho', 'English'], economicBlocks: ['SADC'], flagEmoji: '🇱🇸', coordinates: { lat: -29.6100, lng: 28.2336 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mw', name: 'Malawi', isoCode: 'MWI', iso2Code: 'MW', region: 'Southern Africa', capital: 'Lilongwe', population: 20931751, youthPopulation: 7326113, youthPercentage: 35.0, area: 118484, currency: 'MWK', languages: ['English', 'Chichewa'], economicBlocks: ['SADC', 'COMESA'], flagEmoji: '🇲🇼', coordinates: { lat: -13.2543, lng: 34.3015 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mz', name: 'Mozambique', isoCode: 'MOZ', iso2Code: 'MZ', region: 'Southern Africa', capital: 'Maputo', population: 32969517, youthPopulation: 11539331, youthPercentage: 35.0, area: 801590, currency: 'MZN', languages: ['Portuguese'], economicBlocks: ['SADC'], flagEmoji: '🇲🇿', coordinates: { lat: -18.6657, lng: 35.5296 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'na', name: 'Namibia', isoCode: 'NAM', iso2Code: 'NA', region: 'Southern Africa', capital: 'Windhoek', population: 2604172, youthPopulation: 781252, youthPercentage: 30.0, area: 825615, currency: 'NAD', languages: ['English'], economicBlocks: ['SADC'], flagEmoji: '🇳🇦', coordinates: { lat: -22.9576, lng: 18.4904 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'za', name: 'South Africa', isoCode: 'ZAF', iso2Code: 'ZA', region: 'Southern Africa', capital: 'Pretoria', population: 60414495, youthPopulation: 18124349, youthPercentage: 30.0, area: 1221037, currency: 'ZAR', languages: ['Zulu', 'Xhosa', 'Afrikaans', 'English'], economicBlocks: ['SADC'], flagEmoji: '🇿🇦', coordinates: { lat: -30.5595, lng: 22.9375 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'zm', name: 'Zambia', isoCode: 'ZMB', iso2Code: 'ZM', region: 'Southern Africa', capital: 'Lusaka', population: 20017675, youthPopulation: 7006186, youthPercentage: 35.0, area: 752612, currency: 'ZMW', languages: ['English'], economicBlocks: ['SADC', 'COMESA'], flagEmoji: '🇿🇲', coordinates: { lat: -13.1339, lng: 27.8493 }, createdAt: new Date(), updatedAt: new Date() },
  { id: 'zw', name: 'Zimbabwe', isoCode: 'ZWE', iso2Code: 'ZW', region: 'Southern Africa', capital: 'Harare', population: 16320537, youthPopulation: 5712188, youthPercentage: 35.0, area: 390757, currency: 'ZWL', languages: ['English', 'Shona', 'Ndebele'], economicBlocks: ['SADC', 'COMESA'], flagEmoji: '🇿🇼', coordinates: { lat: -19.0154, lng: 29.1549 }, createdAt: new Date(), updatedAt: new Date() },
];

// ============================================
// REGIONS
// ============================================

export const REGIONS: { name: RegionType; countries: string[] }[] = [
  { name: 'North Africa', countries: ['dz', 'eg', 'ly', 'ma', 'tn', 'sd'] },
  { name: 'West Africa', countries: ['bj', 'bf', 'cv', 'ci', 'gm', 'gh', 'gn', 'gw', 'lr', 'ml', 'mr', 'ne', 'ng', 'sn', 'sl', 'tg'] },
  { name: 'Central Africa', countries: ['cm', 'cf', 'td', 'cg', 'cd', 'gq', 'ga', 'st'] },
  { name: 'East Africa', countries: ['bi', 'km', 'dj', 'er', 'et', 'ke', 'mg', 'mu', 'rw', 'sc', 'so', 'ss', 'tz', 'ug'] },
  { name: 'Southern Africa', countries: ['ao', 'bw', 'sz', 'ls', 'mw', 'mz', 'na', 'za', 'zm', 'zw'] },
];

// ============================================
// THEMES
// ============================================

// The seven AYO core themes. Slugs match the Theme table in Supabase.
// Weights live on Theme.weight in the DB (20/15/15/15/15/10/10).
export const THEMES: Theme[] = [
  { id: 'youth-demography-participation', name: 'Youth Demography & Participation', slug: 'youth-demography-participation', description: 'Youth population structure, civic participation, voter turnout, political representation, and inclusion of youth with disabilities.', icon: 'Users',        color: '#2563EB', indicatorCount: 17, order: 1 },
  { id: 'education',                       name: 'Education',                        slug: 'education',                       description: 'Youth literacy, enrollment across primary/secondary/tertiary, dropout, teacher ratios, and education spending.',            icon: 'GraduationCap', color: '#7C3AED', indicatorCount: 15, order: 2 },
  { id: 'employment',                      name: 'Employment',                       slug: 'employment',                      description: 'Youth unemployment, labor-force participation, employment-to-population ratio, sectoral split, and informal work.',           icon: 'Briefcase',     color: '#EA580C', indicatorCount: 13, order: 3 },
  { id: 'health',                          name: 'Health',                           slug: 'health',                          description: 'Skilled births, contraceptive access, HIV prevalence and treatment, mortality, suicide, mental health, and health spending.', icon: 'HeartPulse',    color: '#DC2626', indicatorCount: 20, order: 4 },
  { id: 'entrepreneurship',                name: 'Entrepreneurship',                 slug: 'entrepreneurship',                description: 'Startup survival, microcredit, IP registrations, credit access, digital infrastructure, and the financial-inclusion environment.', icon: 'Rocket',       color: '#0891B2', indicatorCount: 35, order: 5 },
  { id: 'peace-security',                  name: 'Peace & Security',                 slug: 'peace-security',                  description: 'Internally displaced youth, victims of trafficking, and deaths from violent extremism.',                                       icon: 'Shield',        color: '#16A34A', indicatorCount: 3,  order: 6 },
  { id: 'access-to-justice',               name: 'Access to Justice',                slug: 'access-to-justice',               description: 'Youth awaiting trial, youth imprisoned, and juvenile detentions.',                                                              icon: 'Scale',         color: '#9333EA', indicatorCount: 4,  order: 7 },
];

// ============================================
// INDICATORS
// ============================================

export const INDICATORS: Indicator[] = [
  // EDUCATION INDICATORS
  { id: 'edu001', name: 'Youth Literacy Rate', shortName: 'Literacy Rate', code: 'EDU001', unit: 'percentage', description: 'Percentage of youth (15-35) who can read and write', themeId: 'education', methodology: 'UNESCO Institute for Statistics methodology', sourceDefault: 'UNESCO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['literacy', 'basic education'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'edu002', name: 'Secondary School Enrollment Rate', shortName: 'Secondary Enrollment', code: 'EDU002', unit: 'percentage', description: 'Gross enrollment ratio in secondary education for youth', themeId: 'education', methodology: 'Number of students enrolled regardless of age divided by population of official secondary school age', sourceDefault: 'UNESCO', minValue: 0, maxValue: 150, isHigherBetter: true, isPublic: true, tags: ['enrollment', 'secondary education'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'edu003', name: 'Tertiary Education Enrollment', shortName: 'Tertiary Enrollment', code: 'EDU003', unit: 'percentage', description: 'Gross enrollment ratio in tertiary education', themeId: 'education', methodology: 'UNESCO methodology for tertiary enrollment', sourceDefault: 'UNESCO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['enrollment', 'higher education', 'university'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'edu004', name: 'STEM Graduates Share', shortName: 'STEM Graduates', code: 'EDU004', unit: 'percentage', description: 'Percentage of graduates in STEM fields', themeId: 'education', methodology: 'Share of tertiary graduates in Science, Technology, Engineering, and Mathematics', sourceDefault: 'UNESCO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['STEM', 'higher education', 'skills'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'edu005', name: 'School Completion Rate', shortName: 'Completion Rate', code: 'EDU005', unit: 'percentage', description: 'Percentage of youth completing upper secondary education', themeId: 'education', methodology: 'Percentage of cohort completing final year of upper secondary', sourceDefault: 'World Bank', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['completion', 'secondary education'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'edu006', name: 'Vocational Training Enrollment', shortName: 'TVET Enrollment', code: 'EDU006', unit: 'percentage', description: 'Youth enrolled in technical and vocational education and training', themeId: 'education', methodology: 'Share of upper secondary students in vocational programs', sourceDefault: 'UNESCO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['vocational', 'TVET', 'skills'], createdAt: new Date(), updatedAt: new Date() },

  // EMPLOYMENT INDICATORS
  { id: 'emp001', name: 'Youth Unemployment Rate', shortName: 'Unemployment', code: 'EMP001', unit: 'percentage', description: 'Percentage of youth labor force that is unemployed', themeId: 'employment', methodology: 'ILO standard methodology for unemployment measurement', sourceDefault: 'ILO', minValue: 0, maxValue: 100, isHigherBetter: false, isPublic: true, tags: ['unemployment', 'labor'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'emp002', name: 'Youth Labor Force Participation', shortName: 'Labor Participation', code: 'EMP002', unit: 'percentage', description: 'Share of youth who are employed or actively seeking employment', themeId: 'employment', methodology: 'ILO labor force participation rate methodology', sourceDefault: 'ILO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['labor force', 'participation'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'emp003', name: 'Youth NEET Rate', shortName: 'NEET Rate', code: 'EMP003', unit: 'percentage', description: 'Youth not in employment, education, or training', themeId: 'employment', methodology: 'ILO NEET calculation methodology', sourceDefault: 'ILO', minValue: 0, maxValue: 100, isHigherBetter: false, isPublic: true, tags: ['NEET', 'vulnerability'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'emp004', name: 'Youth Self-Employment Rate', shortName: 'Self-Employment', code: 'EMP004', unit: 'percentage', description: 'Share of employed youth who are self-employed', themeId: 'employment', methodology: 'Self-employed as share of total youth employment', sourceDefault: 'ILO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['entrepreneurship', 'self-employment'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'emp005', name: 'Informal Employment Rate', shortName: 'Informal Employment', code: 'EMP005', unit: 'percentage', description: 'Share of youth employed in informal sector', themeId: 'employment', methodology: 'ILO informal employment methodology', sourceDefault: 'ILO', minValue: 0, maxValue: 100, isHigherBetter: false, isPublic: true, tags: ['informal', 'decent work'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'emp006', name: 'Youth Entrepreneurship Rate', shortName: 'Entrepreneurship', code: 'EMP006', unit: 'percentage', description: 'Percentage of youth who own or manage a business', themeId: 'employment', methodology: 'Global Entrepreneurship Monitor methodology', sourceDefault: 'GEM', minValue: 0, maxValue: 50, isHigherBetter: true, isPublic: true, tags: ['entrepreneurship', 'business'], createdAt: new Date(), updatedAt: new Date() },

  // HEALTH INDICATORS
  { id: 'hlt001', name: 'Youth Mortality Rate', shortName: 'Mortality Rate', code: 'HLT001', unit: 'rate_per_1000', description: 'Deaths per 1,000 population aged 15-35', themeId: 'health', methodology: 'WHO mortality rate calculation', sourceDefault: 'WHO', minValue: 0, maxValue: 50, isHigherBetter: false, isPublic: true, tags: ['mortality', 'survival'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'hlt002', name: 'HIV Prevalence (Youth)', shortName: 'HIV Prevalence', code: 'HLT002', unit: 'percentage', description: 'HIV prevalence rate among youth aged 15-35', themeId: 'health', methodology: 'UNAIDS estimation methodology', sourceDefault: 'UNAIDS', minValue: 0, maxValue: 30, isHigherBetter: false, isPublic: true, tags: ['HIV', 'sexual health'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'hlt003', name: 'Adolescent Fertility Rate', shortName: 'Adolescent Fertility', code: 'HLT003', unit: 'rate_per_1000', description: 'Births per 1,000 women aged 15-19', themeId: 'health', methodology: 'UN Population Division methodology', sourceDefault: 'UN Population', minValue: 0, maxValue: 250, isHigherBetter: false, isPublic: true, tags: ['fertility', 'reproductive health'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'hlt004', name: 'Access to Healthcare', shortName: 'Healthcare Access', code: 'HLT004', unit: 'percentage', description: 'Youth with access to essential health services', themeId: 'health', methodology: 'WHO Universal Health Coverage index', sourceDefault: 'WHO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['access', 'healthcare'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'hlt005', name: 'Mental Health Support Access', shortName: 'Mental Health Access', code: 'HLT005', unit: 'percentage', description: 'Youth with access to mental health services', themeId: 'health', methodology: 'WHO mental health atlas methodology', sourceDefault: 'WHO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['mental health', 'support'], createdAt: new Date(), updatedAt: new Date() },

  // CIVIC ENGAGEMENT INDICATORS
  { id: 'civ001', name: 'Youth Voter Turnout', shortName: 'Voter Turnout', code: 'CIV001', unit: 'percentage', description: 'Percentage of eligible youth who voted in last election', themeId: 'youth-demography-participation', methodology: 'Electoral commission data and surveys', sourceDefault: 'IDEA', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['voting', 'democracy'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'civ002', name: 'Youth in Parliament', shortName: 'Youth MPs', code: 'CIV002', unit: 'percentage', description: 'Percentage of parliamentary seats held by youth under 35', themeId: 'youth-demography-participation', methodology: 'IPU data on parliamentary composition', sourceDefault: 'IPU', minValue: 0, maxValue: 50, isHigherBetter: true, isPublic: true, tags: ['parliament', 'representation'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'civ003', name: 'Civil Society Participation', shortName: 'CSO Participation', code: 'CIV003', unit: 'percentage', description: 'Youth active in civil society organizations', themeId: 'youth-demography-participation', methodology: 'Survey-based measurement', sourceDefault: 'Afrobarometer', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['civil society', 'participation'], createdAt: new Date(), updatedAt: new Date() },

  // INNOVATION & TECHNOLOGY INDICATORS
  { id: 'inn001', name: 'Internet Penetration (Youth)', shortName: 'Internet Access', code: 'INN001', unit: 'percentage', description: 'Percentage of youth with internet access', themeId: 'entrepreneurship', methodology: 'ITU measurement methodology', sourceDefault: 'ITU', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['internet', 'digital access'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'inn002', name: 'Mobile Phone Ownership (Youth)', shortName: 'Mobile Ownership', code: 'INN002', unit: 'percentage', description: 'Percentage of youth owning a mobile phone', themeId: 'entrepreneurship', methodology: 'GSMA measurement methodology', sourceDefault: 'GSMA', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['mobile', 'digital access'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'inn003', name: 'Digital Skills Index', shortName: 'Digital Skills', code: 'INN003', unit: 'index', description: 'Composite index of digital literacy and skills', themeId: 'entrepreneurship', methodology: 'ITU digital skills framework', sourceDefault: 'ITU', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['skills', 'digital literacy'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'inn004', name: 'Youth Tech Startups', shortName: 'Tech Startups', code: 'INN004', unit: 'number', description: 'Number of youth-founded tech startups', themeId: 'entrepreneurship', methodology: 'Startup ecosystem tracking', sourceDefault: 'Various', minValue: 0, maxValue: 10000, isHigherBetter: true, isPublic: true, tags: ['startups', 'entrepreneurship', 'tech'], createdAt: new Date(), updatedAt: new Date() },

  // AGRICULTURE INDICATORS
  { id: 'agr001', name: 'Youth in Agriculture', shortName: 'Agri Employment', code: 'AGR001', unit: 'percentage', description: 'Share of youth employed in agriculture sector', themeId: 'employment', methodology: 'ILO sectoral employment data', sourceDefault: 'FAO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['agriculture', 'employment'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'agr002', name: 'Youth Land Access', shortName: 'Land Access', code: 'AGR002', unit: 'percentage', description: 'Percentage of youth with access to agricultural land', themeId: 'employment', methodology: 'FAO land tenure surveys', sourceDefault: 'FAO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['land', 'access'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'agr003', name: 'Youth Agribusiness Ownership', shortName: 'Agribusiness', code: 'AGR003', unit: 'percentage', description: 'Share of agribusinesses owned by youth', themeId: 'employment', methodology: 'Agricultural census data', sourceDefault: 'FAO', minValue: 0, maxValue: 50, isHigherBetter: true, isPublic: true, tags: ['agribusiness', 'ownership'], createdAt: new Date(), updatedAt: new Date() },

  // GENDER INDICATORS
  { id: 'gen001', name: 'Gender Parity Index (Education)', shortName: 'GPI Education', code: 'GEN001', unit: 'index', description: 'Ratio of female to male enrollment in education', themeId: 'health', methodology: 'UNESCO GPI methodology', sourceDefault: 'UNESCO', minValue: 0, maxValue: 2, isHigherBetter: true, isPublic: true, tags: ['gender', 'education', 'parity'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'gen002', name: 'Female Youth Unemployment Gap', shortName: 'Female Unemployment Gap', code: 'GEN002', unit: 'percentage', description: 'Difference between female and male youth unemployment rates', themeId: 'health', methodology: 'ILO gender gap calculation', sourceDefault: 'ILO', minValue: -50, maxValue: 50, isHigherBetter: false, isPublic: true, tags: ['gender', 'employment', 'gap'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'gen003', name: 'Female Youth Labor Participation', shortName: 'Female Labor Rate', code: 'GEN003', unit: 'percentage', description: 'Labor force participation rate for female youth', themeId: 'health', methodology: 'ILO methodology', sourceDefault: 'ILO', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['gender', 'labor', 'participation'], createdAt: new Date(), updatedAt: new Date() },

  // FINANCIAL INCLUSION INDICATORS
  { id: 'fin001', name: 'Youth Bank Account Ownership', shortName: 'Bank Account', code: 'FIN001', unit: 'percentage', description: 'Percentage of youth with a bank account', themeId: 'entrepreneurship', methodology: 'World Bank Global Findex', sourceDefault: 'World Bank', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['banking', 'financial inclusion'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'fin002', name: 'Youth Mobile Money Usage', shortName: 'Mobile Money', code: 'FIN002', unit: 'percentage', description: 'Percentage of youth using mobile money services', themeId: 'entrepreneurship', methodology: 'GSMA and World Bank Findex', sourceDefault: 'GSMA', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['mobile money', 'fintech'], createdAt: new Date(), updatedAt: new Date() },
  { id: 'fin003', name: 'Youth Access to Credit', shortName: 'Credit Access', code: 'FIN003', unit: 'percentage', description: 'Percentage of youth with access to formal credit', themeId: 'entrepreneurship', methodology: 'World Bank enterprise and household surveys', sourceDefault: 'World Bank', minValue: 0, maxValue: 100, isHigherBetter: true, isPublic: true, tags: ['credit', 'loans', 'access'], createdAt: new Date(), updatedAt: new Date() },
];

// ============================================
// YOUTH INDEX DIMENSIONS
// ============================================

// AYO Youth Index — seven weighted dimensions. Total = 100%.
// Source of truth for sub-indicator weights: apps/api/src/modules/youth-index/youth-index-weights.ts.
export const YOUTH_INDEX_DIMENSIONS: YouthIndexDimension[] = [
  {
    name: 'Youth Demography & Participation',
    weight: 0.20,
    color: '#2563EB',
    indicators: ['youth-voter-turnout', 'youth-share-of-population', 'youth-political-participation-index', 'youth-seats-in-parliament', 'youth-trust-in-government-index', 'freedom-of-association-score'],
    description: 'Population structure, civic participation, voter turnout, political representation.',
  },
  {
    name: 'Education',
    weight: 0.15,
    color: '#7C3AED',
    indicators: ['youth-literacy-rate', 'secondary-school-net-enrollment-rate', 'tertiary-education-gross-enrollment-rate', 'school-dropout-rate', 'primary-enrollment-rate', 'education-budget-share-gdp', 'teacher-student-ratio'],
    description: 'Literacy, enrollment, completion, and education spending.',
  },
  {
    name: 'Employment',
    weight: 0.15,
    color: '#EA580C',
    indicators: ['youth-unemployment-rate', 'youth-labor-force-participation-rate', 'youth-employment-to-population-ratio', 'youth-adult-unemployment-ratio', 'informal-employment-rate'],
    description: 'Unemployment, labor-force participation, and decent-work signals.',
  },
  {
    name: 'Health',
    weight: 0.15,
    color: '#DC2626',
    indicators: ['births-by-skilled-staff', 'physician-density', 'hiv-prevalence-rate-youth', 'yplwha-treatment-rate', 'youth-suicide-rate', 'contraceptive-prevalence-rate-youth', 'maternal-mortality-ratio', 'health-budget-share', 'youth-aids-deaths', 'youth-substance-abuse-deaths'],
    description: 'Skilled care, disease burden, mortality, and health-system spending.',
  },
  {
    name: 'Entrepreneurship',
    weight: 0.15,
    color: '#0891B2',
    indicators: ['youth-startup-survival-rate', 'youth-microcredit-recipients', 'internet-access-households', 'getting-credit-rank', 'protecting-investors-rank', 'youth-ip-registrations', 'youth-entrepreneurship-rate', 'mobile-money-account-penetration', 'financial-literacy-rate'],
    description: 'Startup environment, credit access, digital infrastructure, and IP.',
  },
  {
    name: 'Peace & Security',
    weight: 0.10,
    color: '#16A34A',
    indicators: ['youth-idps', 'youth-trafficking-victims', 'youth-extremism-deaths'],
    description: 'Displacement, trafficking, and youth deaths from violent extremism.',
  },
  {
    name: 'Access to Justice',
    weight: 0.10,
    color: '#9333EA',
    indicators: ['youth-awaiting-trial', 'youth-imprisoned', 'juvenile-detentions'],
    description: 'Pre-trial backlog, incarceration, and juvenile detention.',
  },
];

// ============================================
// YEARS AVAILABLE
// ============================================

export const AVAILABLE_YEARS = Array.from({ length: 15 }, (_, i) => 2010 + i); // 2010-2024

export const LATEST_DATA_YEAR = 2024;

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getCountryById = (id: string): Country | undefined => 
  AFRICAN_COUNTRIES.find(c => c.id === id);

export const getCountryByIsoCode = (isoCode: string): Country | undefined => 
  AFRICAN_COUNTRIES.find(c => c.isoCode === isoCode || c.iso2Code === isoCode);

export const getCountryByName = (name: string): Country | undefined => 
  AFRICAN_COUNTRIES.find(c => c.name.toLowerCase() === name.toLowerCase());

export const getCountriesByRegion = (region: RegionType): Country[] => 
  AFRICAN_COUNTRIES.filter(c => c.region === region);

export const getThemeById = (id: string): Theme | undefined => 
  THEMES.find(t => t.id === id);

export const getIndicatorById = (id: string): Indicator | undefined => 
  INDICATORS.find(i => i.id === id);

export const getIndicatorsByTheme = (themeId: string): Indicator[] => 
  INDICATORS.filter(i => i.themeId === themeId);

export const getRegionName = (region: RegionType): string => region;

export const formatPopulation = (pop: number): string => {
  if (pop >= 1000000000) return `${(pop / 1000000000).toFixed(1)}B`;
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(1)}K`;
  return pop.toString();
};

export const formatValue = (value: number, unit: string): string => {
  switch (unit) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'rate_per_1000':
      return `${value.toFixed(1)} per 1,000`;
    case 'rate_per_100000':
      return `${value.toFixed(1)} per 100,000`;
    case 'currency_usd':
      return `$${value.toLocaleString()}`;
    case 'index':
      return value.toFixed(2);
    case 'years':
      return `${value.toFixed(1)} years`;
    default:
      return value.toLocaleString();
  }
};
