/**
 * Generate a round-robin schedule for a list of team IDs.
 * Returns array of rounds, each round is an array of { home, away }.
 */
export function generateRoundRobin(teamIds, legs = 1) {
  const teams = [...teamIds]
  if (teams.length % 2 !== 0) teams.push('BYE')
  const n = teams.length
  const allRounds = []

  for (let leg = 0; leg < legs; leg++) {
    const legTeams = leg % 2 === 0 ? [...teams] : [...teams].reverse()
    for (let round = 0; round < n - 1; round++) {
      const matches = []
      for (let i = 0; i < n / 2; i++) {
        const home = legTeams[i]
        const away = legTeams[n - 1 - i]
        if (home !== 'BYE' && away !== 'BYE' && home !== away) {
          matches.push({ home_team_id: home, away_team_id: away })
        }
      }
      allRounds.push(matches)
      legTeams.splice(1, 0, legTeams.pop())
    }
  }
  return allRounds
}

/**
 * Generate cup bracket for n teams (knockout).
 * Returns array of rounds.
 */
export function generateKnockout(teamIds) {
  const shuffled = [...teamIds].sort(() => Math.random() - 0.5)
  const rounds = []
  let current = shuffled

  while (current.length > 1) {
    const matches = []
    for (let i = 0; i < current.length; i += 2) {
      if (current[i + 1]) {
        matches.push({ home_team_id: current[i], away_team_id: current[i + 1] })
      }
    }
    rounds.push(matches)
    current = current.slice(0, Math.ceil(current.length / 2)) // placeholders for winners
  }
  return rounds
}

/**
 * Generate UCL-style group stage (groups of 4, each plays home+away).
 */
export function generateGroupStage(teamIds, groupSize = 4) {
  const groups = {}
  for (let i = 0; i < teamIds.length; i++) {
    const groupLetter = String.fromCharCode(65 + Math.floor(i / groupSize))
    if (!groups[groupLetter]) groups[groupLetter] = []
    groups[groupLetter].push(teamIds[i])
  }

  const allMatches = []
  for (const [groupId, members] of Object.entries(groups)) {
    const rounds = generateRoundRobin(members)
    rounds.forEach((round, ri) => {
      round.forEach(m => allMatches.push({ ...m, group_id: groupId, round: ri + 1, stage: 'group' }))
    })
    // return legs
    const rounds2 = generateRoundRobin(members)
    rounds2.forEach((round, ri) => {
      round.forEach(m => allMatches.push({
        home_team_id: m.away_team_id,
        away_team_id: m.home_team_id,
        group_id: groupId,
        round: rounds.length + ri + 1,
        stage: 'group'
      }))
    })
  }
  return allMatches
}
