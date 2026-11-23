import { determineRequestDirection } from "./matching.js";

/**
 * Calculates rating summary for profile view.
 * When count is 0, average MUST be null (never default to 4.9).
 * When count > 0, average is rounded to 1 decimal place.
 */
export function buildRatingSummary(rawAvg, count) {
  if (count <= 0 || rawAvg === null) {
    return { average: null, count: 0 };
  }
  return {
    average: parseFloat(rawAvg.toFixed(1)),
    count,
  };
}

/**
 * Resolves viewer relationship state with target user.
 */
export function resolveViewerState(
  viewerId,
  targetUserId,
  match,
  hasReviewed
) {
  if (viewerId === targetUserId) {
    return {
      isSelf: true,
      matchStatus: "NONE",
      matchId: null,
      requestDirection: null,
      hasReviewed: false,
    };
  }

  const validStatuses = {
    PENDING: "PENDING",
    ACCEPTED: "ACCEPTED",
    DECLINED: "DECLINED",
  };

  const matchStatus =
    match && validStatuses[match.status] ? validStatuses[match.status] : "NONE";

  const requestDirection = match
    ? determineRequestDirection({
        userAId: match.userAId,
        userBId: match.userBId,
        currentUserId: viewerId,
        status: match.status,
      })
    : null;

  return {
    isSelf: false,
    matchStatus,
    matchId: match ? match.id : null,
    requestDirection,
    hasReviewed,
  };
}

/**
 * Strips any sensitive fields and constructs safe public profile user.
 * Explicitly guarantees no email, passwordHash, lat, or lng can be returned.
 */
export function buildSafeProfileUser(input) {
  return {
    id: input.id,
    name: input.name,
    image: input.avatarUrl || null,
    avatarUrl: input.avatarUrl || "",
    bio: input.bio || "",
    location: input.location || "",
    skillsTeach: (input.skillsTeach || []).map((st) => ({
      name: st.skill.name,
      category: st.skill.category || "General",
      proficiencyLevel: st.proficiency,
    })),
    skillsLearn: (input.skillsLearn || []).map((sl) => ({
      name: sl.skill.name,
      category: sl.skill.category || "General",
    })),
  };
}

