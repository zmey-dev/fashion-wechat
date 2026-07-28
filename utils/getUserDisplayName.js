function getUserDisplayName(user) {
  if (!user) {
    return '';
  }

  if (user.role === 'company') {
    // Check all possible name fields for company
    if (user.company_name && user.company_name.length > 0) {
      return user.company_name;
    }
    if (user.nickname && user.nickname.length > 0) {
      return user.nickname;
    }
    if (user.name && user.name.length > 0) {
      return user.name;
    }
    // If all are empty, return a default
    return 'Company';
  }

  return user.nickname || user.name || 'User';
}

function getDisplayName(user) {
  if (!user) {
    return '';
  }

  if (user.role === 'company') {
    // Check all possible name fields for company
    if (user.company_name && user.company_name.length > 0) {
      return user.company_name;
    }
    if (user.nickname && user.nickname.length > 0) {
      return user.nickname;
    }
    if (user.name && user.name.length > 0) {
      return user.name;
    }
    // If all are empty, return a default
    return 'Company';
  }

  return user.nickname || user.name || 'User';
}

module.exports = {
  getUserDisplayName,
  getDisplayName
};