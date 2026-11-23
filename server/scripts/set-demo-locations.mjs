import { prisma } from '../src/db/prisma.js';

const CITY_COORDINATES = [
  { match: 'koramangala', lat: 12.9352, lng: 77.6245, city: 'Koramangala, Bengaluru' },
  { match: 'hsr layout', lat: 12.9116, lng: 77.6389, city: 'HSR Layout, Bengaluru' },
  { match: 'bengaluru', lat: 12.9716, lng: 77.5946, city: 'Bengaluru' },
  { match: 'bangalore', lat: 12.9716, lng: 77.5946, city: 'Bengaluru' },
  { match: 'bandra', lat: 19.0596, lng: 72.8295, city: 'Bandra, Mumbai' },
  { match: 'mumbai', lat: 19.076, lng: 72.8777, city: 'Mumbai' },
  { match: 'connaught place', lat: 28.6315, lng: 77.2167, city: 'Connaught Place, New Delhi' },
  { match: 'delhi', lat: 28.6139, lng: 77.209, city: 'New Delhi' },
  { match: 'boston', lat: 42.3601, lng: -71.0589, city: 'Boston' },
  { match: 'san francisco', lat: 37.7749, lng: -122.4194, city: 'San Francisco' },
];

function resolveCoordinates(locationText) {
  if (!locationText) return null;
  const lower = locationText.toLowerCase();
  for (const entry of CITY_COORDINATES) {
    if (lower.includes(entry.match)) {
      return { lat: entry.lat, lng: entry.lng, matchedCity: entry.city };
    }
  }
  return null;
}

async function main() {
  const isApply = process.argv.includes('--apply');

  console.log('=== SkillSwap Demo Locations Script ===');
  console.log(`Mode: ${isApply ? 'APPLY (writes to DB)' : 'DRY RUN (no database changes)'}`);

  const users = await prisma.user.findMany({
    where: {
      latitude: null,
      longitude: null,
    },
    select: {
      id: true,
      name: true,
      location: true,
    },
  });

  const candidates = [];
  for (const u of users) {
    const coords = resolveCoordinates(u.location);
    if (coords) {
      candidates.push({
        id: u.id,
        name: u.name,
        location: u.location,
        lat: coords.lat,
        lng: coords.lng,
        matchedCity: coords.matchedCity,
      });
    }
  }

  console.log(`\nFound ${users.length} users with null coordinates.`);
  console.log(`Found ${candidates.length} users matching known demo locations:\n`);

  for (const c of candidates) {
    console.log(
      `  User [${c.id.slice(0, 8)}...] "${c.name}": location "${c.location}" -> (${c.lat}, ${c.lng}) [${c.matchedCity}]`
    );
  }

  if (!isApply) {
    console.log('\n[DRY RUN COMPLETE] Zero database writes performed.');
    console.log('To apply these changes, rerun with --apply flag.');
    return;
  }

  console.log('\nApplying changes to database...');
  let updatedCount = 0;
  for (const c of candidates) {
    await prisma.user.update({
      where: { id: c.id },
      data: {
        latitude: c.lat,
        longitude: c.lng,
      },
    });
    updatedCount++;
  }

  console.log(`Successfully updated coordinates for ${updatedCount} users.`);
}

main()
  .catch((e) => {
    console.error('Error in demo location script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

