// Types
export * from './types';

// Constants
export * from './constants';

// Core calculations
export * from './pillars';
export * from './elements';
export * from './tenGods';
export * from './jigangjang';
export * from './manseryeok';
export * from './report';

// Compatibility engines
export { calculateGeneralCompatibility } from './compatibility-general';
export type { GeneralCompatibilityResult } from './compatibility-general';

export { calculateRomanticCompatibility } from './compatibility-romantic';
export type { RomanticCompatibilityResult } from './compatibility-romantic';

export { calculateDeepCompatibility } from './compatibility-deep';
export type { DeepCompatibilityResult } from './compatibility-deep';

export { calculateFullCompatibility } from './compatibility-v2';
export type { FullCompatibilityResult, DetailFactor } from './compatibility-v2';

export { calculateCompatibility } from './compatibility';

// Reverse match
export { findIdealMatchesV2 } from './reverseMatch-v2';
export type { IdealMatchProfileV2, ReverseMatchV2Input } from './reverseMatch-v2';

export { reverseMatch } from './reverseMatch';
