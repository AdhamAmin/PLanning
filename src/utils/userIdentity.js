export const normalizeEmployeeId = (value) => String(value ?? '').trim();

export const getUserEmployeeId = (user) => {
  const employeeId = normalizeEmployeeId(user?.employeeId);
  if (employeeId) return employeeId;
  return normalizeEmployeeId(user?.id);
};

export const userMatchesEmployeeId = (user, candidate) => {
  const normalizedCandidate = normalizeEmployeeId(candidate).toLowerCase();
  if (!normalizedCandidate) return false;
  return getUserEmployeeId(user).toLowerCase() === normalizedCandidate;
};

export const normalizeUserRecord = (user) => {
  if (!user || typeof user !== 'object') return user;
  const employeeId = getUserEmployeeId(user);
  return employeeId ? { ...user, employeeId } : { ...user };
};
