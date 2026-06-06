import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ODDS_API_KEY = "0cf11a6a7171873876dc3b116246ad67";
const ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds";
const THROTTLE_HOURS = 3;
const THROTTLE_MS = THROTTLE_HOURS * 60 * 60 * 1000;

// Bookmakers to fetch (top 6 UK + DraftKings USA)
const BOOKMAKERS = {
  draftkings: "Draftkings (USA)",
  bet365: "bet365",
  betfair: "Betfair",
  williamhill: "William Hill",
  ladbrokes: "Ladbrokes",
  skybet: "Sky Bet",
  paddypower: "Paddy Power"
};

/**
 * Check if odds need to be refreshed (last update >3 hours ago)
 */
async function shouldRefreshOdds() {
  try {
    const matchesRef = collection(db, "matches");
    const q = query(matchesRef, where("last_odds_update", "!=", null));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // No odds have been fetched yet
      return true;
    }

    // Get the most recent update
    let mostRecentUpdate = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.last_odds_update) {
        const timestamp = data.last_odds_update.toMillis ? data.last_odds_update.toMillis() : data.last_odds_update;
        mostRecentUpdate = Math.max(mostRecentUpdate, timestamp);
      }
    });

    const timeSinceUpdate = Date.now() - mostRecentUpdate;
    return timeSinceUpdate > THROTTLE_MS;
  } catch (error) {
    console.error("Error checking if refresh needed:", error);
    return false; // Don't refresh on error
  }
}

/**
 * Fetch odds from The Odds API
 */
async function fetchOddsFromAPI() {
  try {
    const bookmakerKeys = Object.keys(BOOKMAKERS).join(",");
    const url = `${ODDS_API_URL}?apiKey=${ODDS_API_KEY}&regions=us,uk&markets=h2h&bookmakers=${bookmakerKeys}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status}`);
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error("Error fetching from Odds API:", error);
    throw error;
  }
}

/**
 * Parse decimal odds to implied probability
 */
function oddsToProbability(decimalOdds) {
  return 1 / decimalOdds;
}

/**
 * Extract odds for a match from bookmaker data
 */
function extractMatchOdds(event) {
  const odds = {};

  // For each bookmaker, extract the h2h (head to head) odds
  event.bookmakers.forEach((bookmaker) => {
    const bookmakerKey = bookmaker.key;
    if (!BOOKMAKERS[bookmakerKey]) return; // Skip if not in our list

    const bookmakerName = BOOKMAKERS[bookmakerKey];
    const h2hMarket = bookmaker.markets.find((m) => m.key === "h2h");

    if (!h2hMarket) return;

    const outcomes = h2hMarket.outcomes;
    const homeOutcome = outcomes.find((o) => o.name === event.home_team);
    const awayOutcome = outcomes.find((o) => o.name === event.away_team);
    const drawOutcome = outcomes.find((o) => o.name === "Draw");

    if (homeOutcome && awayOutcome && drawOutcome) {
      odds[bookmakerName] = {
        home_win: homeOutcome.price,
        draw: drawOutcome.price,
        away_win: awayOutcome.price
      };
    }
  });

  return odds;
}

/**
 * Match API event to our match document
 */
function findMatchId(apiEvent, allMatches) {
  return allMatches.find(
    (m) =>
      m.home_team === apiEvent.home_team &&
      m.away_team === apiEvent.away_team &&
      Math.abs(new Date(m.match_date).getTime() - new Date(apiEvent.commence_time).getTime()) < 60000 // Within 1 minute
  )?.match_number;
}

/**
 * Update all match odds in Firestore
 */
async function updateMatchOdds(apiEvents) {
  try {
    const matchesRef = collection(db, "matches");
    const snapshot = await getDocs(matchesRef);
    const allMatches = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id
    }));

    let updated = 0;
    let errors = [];

    for (const apiEvent of apiEvents) {
      try {
        const matchNumber = findMatchId(apiEvent, allMatches);
        if (!matchNumber) {
          console.warn(`Could not match API event: ${apiEvent.home_team} vs ${apiEvent.away_team}`);
          continue;
        }

        const matchDoc = allMatches.find((m) => m.match_number === matchNumber);
        if (!matchDoc) continue;

        const matchRef = doc(db, "matches", matchDoc.id);
        const oddsData = extractMatchOdds(apiEvent);

        if (Object.keys(oddsData).length > 0) {
          await updateDoc(matchRef, {
            odds: oddsData,
            odds_source: "the-odds-api",
            last_odds_update: serverTimestamp()
          });
          updated++;
        }
      } catch (error) {
        errors.push(`Error updating match ${apiEvent.home_team} vs ${apiEvent.away_team}: ${error.message}`);
      }
    }

    console.log(`Updated ${updated} matches with odds`);
    if (errors.length > 0) {
      console.warn("Errors during update:", errors);
    }

    return { updated, errors };
  } catch (error) {
    console.error("Error updating match odds:", error);
    throw error;
  }
}

/**
 * Main function to refresh odds if needed
 */
export async function refreshOddsIfNeeded() {
  try {
    const shouldRefresh = await shouldRefreshOdds();

    if (!shouldRefresh) {
      console.log("Odds are fresh (updated within last 3 hours), skipping refresh");
      return { refreshed: false, reason: "Throttled - updated within 3 hours" };
    }

    console.log("Fetching fresh odds from The Odds API...");
    const apiEvents = await fetchOddsFromAPI();

    if (apiEvents.length === 0) {
      throw new Error("No events returned from Odds API");
    }

    const result = await updateMatchOdds(apiEvents);
    return { refreshed: true, ...result };
  } catch (error) {
    console.error("Error refreshing odds:", error);
    return { refreshed: false, error: error.message };
  }
}

/**
 * Manually trigger odds refresh (for admin page)
 */
export async function forceRefreshOdds() {
  try {
    console.log("Forcing odds refresh...");
    const apiEvents = await fetchOddsFromAPI();

    if (apiEvents.length === 0) {
      throw new Error("No events returned from Odds API");
    }

    const result = await updateMatchOdds(apiEvents);
    return { success: true, ...result };
  } catch (error) {
    console.error("Error force refreshing odds:", error);
    return { success: false, error: error.message };
  }
}
