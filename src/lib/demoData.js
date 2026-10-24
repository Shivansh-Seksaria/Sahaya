/**
 * Generates realistic demo records so the dashboard can be explored
 * without doing 100 intakes by hand. All names are invented.
 * A seeded random generator makes the demo identical on every load.
 */
import { PLACES, WORKERS, ISSUES } from './places.js'
import { checkEligibility } from './eligibility.js'

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const FEMALE = ['Savitri', 'Gangavva', 'Renuka', 'Shobha', 'Neelamma', 'Fatima', 'Kavya', 'Yallamma', 'Bhagya', 'Sunanda']
const MALE = ['Basavaraj', 'Hanumanth', 'Mallikarjun', 'Imran', 'Shivappa', 'Ramesh', 'Fakirappa', 'Siddappa', 'Yusuf', 'Naveen']
const SURNAME = ['Hiremath', 'Kambar', 'Talwar', 'Naik', 'Doddamani', 'Madar', 'Kulkarni', 'Shaikh', 'Hosamani', 'Pujar']

const DESCRIPTIONS = {
  land: 'Neighbour has encroached on two guntas of farm land. Pahani (RTC) still shows father as owner.',
  domestic: 'Husband and in-laws harass for more dowry. Wants protection order and residence rights.',
  wages: 'Thirty days of MGNREGA work done in June. Wages not credited to bank account.',
  pension: 'Widow pension stopped after Aadhaar seeding error at the bank.',
  documents: 'Needs caste and income certificate for child’s school admission. Application pending for months.',
  family: 'Separated from husband two years ago. Seeking maintenance for self and two children.',
  criminal: 'Son arrested, family cannot afford a lawyer for the bail hearing.',
  other: 'Cheated by a finance company over a two-wheeler loan. Vehicle seized without notice.',
}

export function generateDemoRecords(count = 140, incomeLimit = 100000) {
  const r = rng(42)
  const pick = arr => arr[Math.floor(r() * arr.length)]
  const now = Date.now()
  const out = []

  for (let i = 0; i < count; i++) {
    const place = pick(PLACES)
    const worker = pick(WORKERS)
    const gender = r() < 0.58 ? 'female' : r() < 0.97 ? 'male' : 'other'
    const first = gender === 'female' ? pick(FEMALE) : pick(MALE)
    const issue = gender === 'female' && r() < 0.3 ? pick(['domestic', 'family']) : pick(ISSUES)
    const age = r() < 0.06 ? 14 + Math.floor(r() * 4) : 19 + Math.floor(r() * 55)
    const incomeMissing = r() < 0.05
    const beneficiary = {
      name: `${first} ${pick(SURNAME)}`,
      age,
      gender,
      phone: r() < 0.7 ? '9' + Math.floor(100000000 + r() * 899999999) : '',
      annualIncome: incomeMissing ? '' : Math.round((24000 + r() * 220000) / 1000) * 1000,
      flags: {
        scst: r() < 0.3,
        trafficking: r() < 0.01,
        disability: r() < 0.06,
        disaster: r() < 0.08,
        industrialWorker: r() < 0.07,
        custody: issue === 'criminal' && r() < 0.6,
      },
    }
    // Recorded over the last 16 weeks, more recent weeks busier.
    const daysAgo = Math.floor(Math.pow(r(), 1.4) * 112)
    const createdAt = new Date(now - daysAgo * 864e5 - r() * 8 * 36e5).toISOString()
    const ageWeeks = daysAgo / 7
    const statusRoll = r()
    const status =
      ageWeeks > 8 ? (statusRoll < 0.6 ? 'resolved' : statusRoll < 0.85 ? 'in_progress' : 'referred')
      : ageWeeks > 3 ? (statusRoll < 0.25 ? 'resolved' : statusRoll < 0.6 ? 'in_progress' : statusRoll < 0.85 ? 'referred' : 'new')
      : statusRoll < 0.55 ? 'new' : 'referred'

    const noGps = r() < 0.04
    out.push({
      id: `LA-DEMO-${String(i + 1).padStart(4, '0')}`,
      createdAt,
      workerId: worker.id,
      workerName: worker.name,
      taluk: place.taluk,
      village: place.village,
      beneficiary,
      issue: {
        category: issue,
        urgency: issue === 'criminal' || issue === 'domestic' ? (r() < 0.6 ? 'high' : 'medium') : pick(['low', 'medium', 'medium', 'high']),
        description: DESCRIPTIONS[issue],
      },
      eligibility: checkEligibility(beneficiary, incomeLimit),
      gps: noGps ? null : {
        lat: place.lat + (r() - 0.5) * 0.03,
        lng: place.lng + (r() - 0.5) * 0.03,
        accuracy: r() < 0.05 ? 180 + Math.floor(r() * 300) : 5 + Math.floor(r() * 40),
      },
      photo: r() < 0.95 ? 'demo' : null,
      consent: r() < 0.97,
      status,
    })
  }
  // Two deliberate duplicates so the data-quality panel has something to catch.
  out.push({ ...out[3], id: 'LA-DEMO-DUP1', createdAt: new Date(new Date(out[3].createdAt).getTime() - 2 * 864e5).toISOString() })
  out.push({ ...out[10], id: 'LA-DEMO-DUP2', createdAt: new Date(new Date(out[10].createdAt).getTime() - 5 * 864e5).toISOString() })
  return out
}
