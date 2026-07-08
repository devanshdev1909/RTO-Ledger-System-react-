/**
 * Formats a input string into standard Indian RTO vehicle number format: XX-XX-XX-XXXX
 * Example: MH-12-SD-3421
 */
export const formatVehicleNumber = (value) => {
  // Keep only alphanumeric characters and uppercase them
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parts = [];
  
  // State code (2 letters)
  if (clean.length > 0) {
    parts.push(clean.substring(0, 2).replace(/[^A-Z]/g, ''));
  }
  // District code (2 digits)
  if (clean.length > 2) {
    parts.push(clean.substring(2, 4).replace(/[^0-9]/g, ''));
  }
  // Series code (2 letters)
  if (clean.length > 4) {
    parts.push(clean.substring(4, 6).replace(/[^A-Z]/g, ''));
  }
  // Unique number (4 digits)
  if (clean.length > 6) {
    parts.push(clean.substring(6, 10).replace(/[^0-9]/g, ''));
  }
  
  return parts.filter(Boolean).join('-');
};

/**
 * Formats Chassis or Engine numbers: auto-uppercased, stripped of symbols, 
 * and separated into blocks of 5 characters with hyphens.
 */
export const formatChassisOrEngine = (value) => {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matches = clean.match(/.{1,5}/g);
  return matches ? matches.join('-') : clean;
};
