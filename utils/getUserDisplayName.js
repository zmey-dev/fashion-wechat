/**
 * 사용자 유형에 따라 표시할 이름을 반환하는 유틸리티 함수
 * @param {Object} user - 사용자 객체
 * @param {string} user.role - 사용자 역할 ('user', 'company', 'teacher' 등)
 * @param {string} user.nickname - 사용자 닉네임
 * @param {string} user.company_name - 회사명
 * @param {string} user.name - 실명 (fallback)
 * @returns {string} - 표시할 이름
 */
function getUserDisplayName(user) {
  if (!user) {
    return '';
  }

  // company 역할인 경우 company_name 우선 사용
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

  // user, teacher 및 기타 역할인 경우 nickname 우선 사용
  return user.nickname || user.name || 'User';
}

/**
 * 사용자 유형에 따라 표시할 이름을 반환하는 WXS용 함수
 * (WeChat Mini Program의 WXS에서 사용 가능)
 */
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