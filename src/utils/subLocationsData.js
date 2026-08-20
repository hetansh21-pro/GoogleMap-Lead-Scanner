// Comprehensive sub-locations mapping & user manual settings helper for LeadMap Pro

export const DEFAULT_AHMEDABAD_AREAS = [
  'Navrangpura',
  'Satellite',
  'SG Highway',
  'Prahlad Nagar',
  'Vastrapur',
  'Bodakdev',
  'Maninagar',
  'Chandkheda',
  'Ashram Road',
  'Bopal',
  'South Bopal',
  'Thaltej',
  'Naroda',
  'CG Road',
  'Paldi',
  'Ranip',
  'Nikol',
  'Odhav',
  'Gota',
  'Science City',
  'Isanpur',
  'Vatva',
  'Shahibaug',
  'Ellisbridge',
  'Motera',
  'Ghatlodiya',
  'Memnagar',
  'Ambli',
  'Sola',
  'Sabarmati',
  'Usmanpura',
  'Jodhpur Village',
  'Naranpura',
  'Law Garden',
  'Sindhu Bhavan Road',
  'Sarkhej',
  'Chandlodiya',
  'Vasna',
  'Juhapura',
  'Gurukul',
  'Drive-In Road',
  'Shilaj',
  'Shela',
  'Asarwa',
  'Amraiwadi',
  'CTM',
  'Hathijan',
  'Ramol',
  'Lambha',
  'Narol',
  'Dani Limda',
  'Kankaria',
  'Jamalpur',
  'Khadia',
  'Kalupur',
  'Dariyapur',
  'Shahpur',
  'Dudheshwar',
  'Subhash Bridge',
  'Tragad',
  'Vaishno Devi Circle',
  'Zundal Circle',
  'Sughad'
];

export const CITY_SUB_LOCATIONS = {
  'Ahmedabad': DEFAULT_AHMEDABAD_AREAS,
  'Mumbai': [
    'Bandra East', 'Bandra West', 'Andheri East', 'Andheri West', 'Juhu', 'Powai',
    'Worli', 'Lower Parel', 'Dadar', 'Thane West', 'Thane East', 'Borivali East',
    'Borivali West', 'Malad East', 'Malad West', 'Navi Mumbai', 'Vashi', 'Kurla',
    'Chembur', 'Ghatkopar', 'Goregaon East', 'Goregaon West', 'Kandivali East',
    'Kandivali West', 'Santacruz', 'Khar', 'Colaba', 'Nariman Point', 'BKC Bandra Kurla Complex',
    'Mulund', 'Vile Parle'
  ],
  'Delhi': [
    'Connaught Place', 'South Extension', 'Dwarka', 'Rohini', 'Saket', 'Nehru Place',
    'Karol Bagh', 'Laxmi Nagar', 'Noida Sector 18', 'Noida Sector 62', 'Gurgaon DLF Cyber City',
    'Gurgaon Sector 29', 'Gurgaon Sohna Road', 'Vasant Kunj', 'Hauz Khas', 'Janakpuri',
    'Pitampura', 'Lajpat Nagar', 'Rajouri Garden', 'Greater Kailash', 'Okhla Industrial Area'
  ],
  'Bangalore': [
    'Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'Electronic City',
    'Jayanagar', 'JP Nagar', 'Marathahalli', 'MG Road', 'Hebbal', 'Yelahanka',
    'Rajajinagar', 'Banashankari', 'BTM Layout', 'Bellandur', 'Sarjapur Road'
  ],
  'Surat': [
    'Adajan', 'Vesu', 'Varachha', 'Piplod', 'Ring Road', 'Katargam', 'City Light',
    'Rander', 'Bhatar', 'Majura Gate', 'Udhna', 'Pal', 'VIP Road', 'Ghod Dod Road', 'Althan'
  ],
  'Vadodara': [
    'Alkapuri', 'Gotri', 'Sayajigunj', 'Manjalpur', 'Akota', 'Karelibaug', 'Fatehgunj',
    'Sama', 'Subhanpura', 'Waghodia Road', 'Vasna Road', 'OP Road'
  ],
  'Rajkot': [
    'Kalawad Road', '150 Feet Ring Road', 'Yagnik Road', 'Kotecha Chowk',
    'University Road', 'Race Course Road', 'Mavdi', 'Bhaktinagar', 'Aji GIDC', 'Pedak Road'
  ],
  'Dubai': [
    'Downtown Dubai', 'Dubai Marina', 'Business Bay', 'Deira', 'Bur Dubai',
    'Jumeirah Lakes Towers (JLT)', 'Jumeirah', 'Al Barsha', 'Sheikh Zayed Road',
    'Al Karama', 'International City', 'Dubai Silicon Oasis', 'Al Quoz Industrial Area'
  ],
  'New York': [
    'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island', 'Midtown Manhattan',
    'Financial District', 'Williamsburg', 'SoHo', 'Harlem', 'Astoria', 'Upper East Side', 'Upper West Side'
  ],
  'London': [
    'City of London', 'Westminster', 'Canary Wharf', 'Camden', 'Kensington',
    'Chelsea', 'Islington', 'Soho', 'Shoreditch', 'Greenwich', 'Brixton'
  ],
  'Toronto': [
    'Downtown Toronto', 'North York', 'Scarborough', 'Etobicoke', 'York', 'Mississauga', 'Markham', 'Brampton'
  ]
};

export const DEFAULT_ZONE_AREAS = [
  'Central Area',
  'North Zone',
  'South Zone',
  'East Zone',
  'West Zone',
  'Downtown / City Center',
  'Commercial Hub & Main Market',
  'Industrial Area & GIDC',
  'Ring Road / Highway Zone',
  'Suburbs & Extension Area',
  'Station Road',
  'Business District'
];

// Helper to get manual custom settings from localStorage
export function getSavedManualBulkAreas() {
  try {
    const saved = localStorage.getItem('leadmap_manual_bulk_areas');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

// Helper to save manual custom settings to localStorage
export function saveManualBulkAreas(areaList) {
  try {
    localStorage.setItem('leadmap_manual_bulk_areas', JSON.stringify(areaList));
  } catch (e) {}
}

export function getSubLocationsForCity(locationName) {
  if (!locationName) return DEFAULT_AHMEDABAD_AREAS;

  // First check if user saved a manual custom override list
  const manualList = getSavedManualBulkAreas();
  const clean = locationName.toLowerCase();

  // If user has saved manual settings and we match Ahmedabad or general
  if (manualList && manualList.length > 0 && clean.includes('ahmedabad')) {
    return manualList;
  }

  for (const [key, areas] of Object.entries(CITY_SUB_LOCATIONS)) {
    if (clean.includes(key.toLowerCase())) {
      return areas;
    }
  }

  const cityNameOnly = locationName.split(',')[0].trim();
  return DEFAULT_ZONE_AREAS.map(zone => `${zone} (${cityNameOnly})`);
}
