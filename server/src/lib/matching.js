/**
 * Pure Matching Engine Module
 * Zero database, zero network, 100% deterministic business logic
 */

/**
 * Calculates average rating rounded to 1 decimal place. Defaults to 4.9 if no reviews.
 */
export function calculateRating(reviews) {
  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1))
      : 4.9;
  return { avgRating, reviewCount: totalReviews };
}

/**
 * Determines matched skill display name:
 * 1. First skill the peer teaches that the current user wants to learn
 * 2. Otherwise, first skill the peer teaches
 * 3. Fallback: "General Skill Swap"
 */
export function determineMatchedSkillName(
  matchingSkillsUserWants,
  peerSkillsTeach
) {
  if (matchingSkillsUserWants.length > 0) {
    return matchingSkillsUserWants[0].skill.name;
  }
  if (peerSkillsTeach.length > 0) {
    return peerSkillsTeach[0].skill.name;
  }
  return "General Skill Swap";
}

/**
 * Determines whether the current user is the requester ('SENT') or recipient ('RECEIVED')
 * of a PENDING match. Returns null for non-pending or unassociated matches.
 */
export function determineRequestDirection({
  userAId,
  userBId,
  currentUserId,
  status,
}) {
  if (status !== "PENDING") {
    return null;
  }
  if (currentUserId === userAId) {
    return "SENT";
  }
  if (currentUserId === userBId) {
    return "RECEIVED";
  }
  return null;
}

/**
 * Finds existing bidirectional match between currentUser and peer.
 */
export function findConnectionStatus(
  currentUserId,
  peerId,
  matches
) {
  const existingMatch = matches.find(
    (m) =>
      (m.userAId === currentUserId && m.userBId === peerId) ||
      (m.userAId === peerId && m.userBId === currentUserId)
  );

  if (existingMatch) {
    const requestDirection = determineRequestDirection({
      userAId: existingMatch.userAId,
      userBId: existingMatch.userBId,
      currentUserId,
      status: existingMatch.status,
    });
    return {
      connectionStatus: existingMatch.status,
      matchId: existingMatch.id,
      requestDirection,
    };
  }
  return {
    connectionStatus: "NONE",
    matchId: null,
    requestDirection: null,
  };
}

/**
 * Computes match details for a single peer against the current user.
 */
export function computePeerMatch(
  currentUser,
  peer,
  matches
) {
  const userLearnSkillNames = currentUser.skillsLearn.map((sl) => sl.skill.name.toLowerCase());
  const peerLearnSkillNames = peer.skillsLearn.map((sl) => sl.skill.name.toLowerCase());

  const { avgRating, reviewCount } = calculateRating(peer.reviewsReceived);

  // Skills peer teaches that current user wants to learn
  const matchingSkillsUserWants = peer.skillsTeach.filter((st) =>
    userLearnSkillNames.includes(st.skill.name.toLowerCase())
  );

  // Skills current user teaches that peer wants to learn
  const matchingSkillsPeerWants = currentUser.skillsTeach.filter((st) =>
    peerLearnSkillNames.includes(st.skill.name.toLowerCase())
  );

  const isMutual = matchingSkillsUserWants.length > 0 && matchingSkillsPeerWants.length > 0;

  const { connectionStatus, matchId, requestDirection } = findConnectionStatus(currentUser.id, peer.id, matches);

  const matchedSkillName = determineMatchedSkillName(matchingSkillsUserWants, peer.skillsTeach);

  return {
    id: peer.id,
    name: peer.name,
    email: peer.email,
    bio: peer.bio || "No bio added yet.",
    location: peer.location || "Nearby",
    avatarUrl: peer.avatarUrl || "",
    avgRating,
    reviewCount,
    isMutual,
    matchedSkillName,
    connectionStatus,
    matchId,
    requestDirection,
    skillsTeach: peer.skillsTeach.map((st) => ({
      id: st.skill.id,
      name: st.skill.name,
      proficiency: st.proficiency,
    })),
    skillsLearn: peer.skillsLearn.map((sl) => ({
      id: sl.skill.id,
      name: sl.skill.name,
    })),
  };
}

/**
 * Master pure function: takes plain domain data and returns the exact API response shape.
 * Guarantees current user is never included in their own match results.
 */
export function computeAllMatches(
  currentUser,
  otherUsers,
  matches
) {
  const eligiblePeers = otherUsers.filter((peer) => peer.id !== currentUser.id);
  const matchResults = eligiblePeers.map((peer) => computePeerMatch(currentUser, peer, matches));

  return {
    currentUser: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      location: currentUser.location || null,
      teachCount: currentUser.skillsTeach.length,
      learnCount: currentUser.skillsLearn.length,
    },
    matches: matchResults,
  };
}

